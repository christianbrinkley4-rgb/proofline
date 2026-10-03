import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { logEvent } from "@/lib/agent/events";
import { db, schema } from "@/lib/db";
import { confirmedFactTexts } from "@/lib/facts/base";
import { requirementsOf } from "@/lib/jobs/store";
import { checkCoverLetter, letterStatus, type CoverLetter, type LetterCheck, type LetterContext } from "@/lib/packet/cover-letter";
import { reviewByConsensus } from "./consensus";
import { LETTER_FRAMINGS } from "./framings";
import type { ModelReview } from "./model";
import { recordGatePrediction } from "@/lib/interviews/service";
import type { Prediction } from "@/lib/interviews/model";
import { changesSince, type DocumentLine, type GateChange } from "./receipt";

/**
 * The cover letter's review gate, the same shape as the resume's: the rules checks
 * must pass and then independent reviewers read the letter against the confirmed
 * facts and the posting (see consensus.ts). A letter still holding the bracketed prompt for the person's own reason
 * never reaches the model, because the one part Proofline will not write is why
 * someone wants a job.
 */

export { LETTER_PROMPT_VERSION, LETTER_SYSTEM_PROMPT } from "./letter-prompt";

export type LetterGateResult = {
  version: 1;
  fingerprint: string;
  checks: LetterCheck[];
  model: ModelReview;
  passed: boolean;
  at: string;
  prediction?: Prediction;
  documentLines?: DocumentLine[];
  changes?: GateChange[];
};

export type LetterGateInput = {
  letter: CoverLetter;
  letterContext: LetterContext;
  /** Posting text the reviewer may use to check claims about the employer. */
  requirements: string;
  jobDescription: string;
  facts: string[];
  factTextById: Map<string, string>;
  evidenceById: Map<string, { factIds: string[]; org?: string | null }>;
};

/** What a reviewer reads: the letter as the employer would, without the person's signature block. */
export function letterReviewText(letter: CoverLetter): string {
  return [letter.greeting, ...letter.paragraphs.map((p) => p.text), letter.signoff].join("\n\n");
}

const WORDS = { min: 60, max: 400 };

/**
 * The rules checks for the gate. They are the export checks, plus three that make
 * a letter fit to send: it names the employer, it sounds like a person, and it is
 * a readable length. The first two are advice in the editor and blocking here.
 */
export function letterGateChecks(input: Pick<LetterGateInput, "letter" | "letterContext" | "factTextById" | "evidenceById">): LetterCheck[] {
  const text = letterReviewText(input.letter);
  const base = checkCoverLetter(input.letter, input.factTextById, input.evidenceById).filter((c) => c.id !== "length");
  const checks = base.map((c) => (c.id === "voice" ? { ...c, blocking: true } : c));
  const company = input.letterContext.company.trim();
  const named = company.length > 0 && text.toLowerCase().includes(company.toLowerCase());
  checks.push({
    id: "names-employer",
    ok: named,
    blocking: true,
    label: "Names the employer",
    detail: named ? `The letter says ${company}.` : `The letter never says ${company}. Redraft it, or say why this employer in your own words.`,
  });
  const words = text.split(/\s+/).filter(Boolean).length;
  const fits = words >= WORDS.min && words <= WORDS.max;
  checks.push({
    id: "gate-length",
    ok: fits,
    blocking: true,
    label: "Readable length",
    detail: fits ? `${words} words.` : words < WORDS.min ? `${words} words is too thin to send. Add one more specific example to your profile and redraft.` : `${words} words. Cut it toward 350 so it gets read.`,
  });
  return checks;
}

export function letterFingerprint(input: Pick<LetterGateInput, "letter" | "facts" | "jobDescription">): string {
  return createHash("sha256").update([letterReviewText(input.letter), [...input.facts].sort().join("\n"), input.jobDescription].join("\n\u0000\n")).digest("hex");
}

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max).trimEnd()}\n[cut to fit the review budget]`);

export function buildLetterReviewInput(input: Pick<LetterGateInput, "letter" | "letterContext" | "requirements" | "facts">): string {
  const ctx = input.letterContext;
  const facts: string[] = [];
  let used = 0;
  for (const [i, fact] of input.facts.entries()) {
    const line = `${i + 1}. ${fact}`;
    if (used + line.length > 6000) break;
    facts.push(line);
    used += line.length + 1;
  }
  const profile = [ctx.school && `School: ${ctx.school}`, ctx.degree && `Degree: ${ctx.degree}`, ctx.major && `Major: ${ctx.major}`, ctx.gradDate && `Graduation: ${ctx.gradDate}`].filter(Boolean).join("; ");
  return [
    `JOB POSTING (${ctx.title} at ${ctx.company}):`,
    clip(input.requirements.trim() || "(The posting has no separate requirements section.)", 2400),
    "",
    "COVER LETTER:",
    clip(letterReviewText(input.letter), 3200),
    "",
    `STUDENT PROFILE (confirmed): ${profile || "(none)"}`,
    "",
    "CONFIRMED FACTS (the only allowed source of claims about the student):",
    facts.join("\n"),
  ].join("\n");
}

/** The pure part of the gate: rules first, then the model only if the rules pass and the letter is finished. */
export async function evaluateLetter(userId: string, input: LetterGateInput, opts: { chargeAccount?: boolean } = {}): Promise<LetterGateResult> {
  const checks = letterGateChecks(input);
  const blocked = checks.filter((c) => c.blocking && !c.ok);
  const unfinished = letterStatus(input.letter) === "needs_you";
  const fingerprint = letterFingerprint(input);
  let model: ModelReview;
  if (blocked.length) {
    model = {
      status: "skipped",
      issues: [],
      model: null,
      message: unfinished ? "The final read-through runs once your reason for wanting this job is in." : "The final read-through runs once everything marked Must fix is fixed.",
    };
  } else {
    const ctx = input.letterContext;
    // Names a sentence may use that no fact holds: the employers and school it names.
    const known = [ctx.company, ctx.title, ctx.school, ctx.degree, ctx.major, ...ctx.evidence.flatMap((e) => [e.org, e.title])].filter((x): x is string => Boolean(x));
    model = await reviewByConsensus(userId, { purpose: "review.letter", framings: LETTER_FRAMINGS, input: buildLetterReviewInput(input), text: letterReviewText(input.letter), facts: input.facts, known, noun: "letter" }, opts);
  }
  return { version: 1, fingerprint, checks, model, passed: !blocked.length && model.status === "pass", at: new Date().toISOString() };
}

/** One plain sentence on why a letter did not pass, from the checks the person can act on. */
export function letterFailureReason(result: LetterGateResult): string {
  const blocked = result.checks.filter((c) => c.blocking && !c.ok);
  if (blocked.some((c) => c.id === "placeholder")) return "Add one or two sentences on why you want this job. That part has to be in your own words.";
  if (blocked.length === 1) return blocked[0].detail || `Fix first: ${blocked[0].label.toLowerCase()}.`;
  if (blocked.length) return `Fix ${blocked.length} things in the cover letter first: ${blocked.map((c) => c.label.toLowerCase()).join("; ")}.`;
  if (result.model.status === "fail") return `The final read-through of the cover letter flagged ${result.model.issues.length === 1 ? "a line" : `${result.model.issues.length} lines`} to fix.`;
  return result.model.message || "The cover letter review could not finish. Check it again from the job page.";
}

/** Reviews the stored letter for one job, stores the verdict beside it, and logs the outcome. */
export async function runLetterGate(userId: string, jobId: string, opts: { chargeAccount?: boolean } = {}): Promise<LetterGateResult | null> {
  // Imported here so this module stays importable from the packet service without a cycle.
  const { getPacket, loadPacketContext, readLetter } = await import("@/lib/packet/service");
  const [ctx, packet] = await Promise.all([loadPacketContext(userId, jobId), getPacket(userId, jobId)]);
  const letter = readLetter(packet);
  if (!ctx || !letter) return null;
  const req = requirementsOf(ctx.job);
  const requirements = [...req.requiredLines.map((l) => `- ${l}`), ...(req.preferredLines.length ? ["Preferred:", ...req.preferredLines.map((l) => `- ${l}`)] : [])].join("\n");
  const facts = await confirmedFactTexts(userId);
  const result = await evaluateLetter(
    userId,
    {
      letter,
      letterContext: ctx.letterContext,
      requirements: requirements || (ctx.job.description ?? "").slice(0, 2400),
      jobDescription: ctx.job.description ?? "",
      facts,
      factTextById: ctx.factText,
      evidenceById: new Map(ctx.evidence.map((e) => [e.id, e])),
    },
    opts,
  );
  result.documentLines = result ? [{ key: "greeting", text: letter.greeting }, ...letter.paragraphs.map((p, index) => ({ key: `${p.purpose}:${index}`, text: p.text })), { key: "signoff", text: letter.signoff }] : [];
  result.changes = changesSince(packet?.letterReview as unknown as LetterGateResult | null, result.documentLines);
  if (result.passed) result.prediction = await recordGatePrediction(userId, jobId, "letter", result.fingerprint);
  await db
    .update(schema.applicationPacket)
    .set({ letterReview: result as unknown as Record<string, unknown> })
    .where(and(eq(schema.applicationPacket.userId, userId), eq(schema.applicationPacket.jobId, jobId)));
  await logEvent(userId, result.passed ? "letter_gate_passed" : "letter_gate_failed", {
    jobId,
    blocking: result.checks.filter((c) => c.blocking && !c.ok).map((c) => c.id),
    model: result.model.status,
    receipt: result,
  });
  if (result.passed && result.prediction) {
    const { prepareRelationship } = await import("@/lib/outreach/service");
    await prepareRelationship(userId, result.prediction.applicationId).catch(() => undefined);
  }
  return result;
}

