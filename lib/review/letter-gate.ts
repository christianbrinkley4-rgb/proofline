import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { logEvent } from "@/lib/agent/events";
import { db, schema } from "@/lib/db";
import { confirmedFactTexts } from "@/lib/facts/base";
import { requirementsOf } from "@/lib/jobs/store";
import { checkCoverLetter, letterStatus, type CoverLetter, type LetterCheck, type LetterContext } from "@/lib/packet/cover-letter";
import { callReviewModel, settleVerdict, type ModelReview } from "./model";

/**
 * The cover letter's review gate, the same shape as the resume's: the rules checks
 * must pass and then a model reads the letter against the confirmed facts and the
 * posting. A letter still holding the bracketed prompt for the person's own reason
 * never reaches the model, because the one part Proofline will not write is why
 * someone wants a job.
 */

export const LETTER_PROMPT_VERSION = "letter-gate.v1";

export const LETTER_SYSTEM_PROMPT = `You are the last reviewer before a student sends a cover letter for one specific job.

The bar: it reads like a person wrote it. It names this employer and role, rests on one or two true examples, and has no filler, no flattery, and no claim the facts do not support.

How to review:
1. Before flagging any claim about the student as invented, search the ENTIRE facts list and the profile and quote the closest supporting line. Only flag a claim if zero supporting language exists anywhere.
2. Prove support, don't hunt guilt. PASS if every claim has support.
3. The sentence about why the student wants this job is theirs. Never fail it for being short, plain, or personal. Fail it only for filler words or for a claim about the employer that the posting does not make.
4. You may NOT fail for: contractions, the greeting or sign-off, the opening line about the student's school and graduation (it comes from their profile), style preferences between two truthful wordings, anything you cannot quote verbatim from the letter, or corrections that add new claims, numbers, or methods the student never confirmed.
5. You may fail for: a claim about the student with no supporting language in the facts; a claim about the employer or the role that is not in the posting; filler, flattery, or wording that reads as machine-written; a sentence that says nothing specific.
6. Every issue must copy the offending letter text exactly, character for character, into "quote"; name the rule it breaks in "rule_broken"; and give a "fix" that uses only the confirmed facts or the posting.

Return strict JSON and nothing else: {"verdict":"PASS"|"FAIL","issues":[{"quote":"...","rule_broken":"...","fix":"..."}]}. PASS means "issues" is an empty array. No prose outside the JSON.`;

export type LetterGateResult = {
  version: 1;
  fingerprint: string;
  checks: LetterCheck[];
  model: ModelReview;
  passed: boolean;
  at: string;
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
    const text = letterReviewText(input.letter);
    const out = await callReviewModel(userId, { purpose: "review.letter", promptVersion: LETTER_PROMPT_VERSION, system: LETTER_SYSTEM_PROMPT, input: buildLetterReviewInput(input) }, opts);
    if (!out.ok) model = { status: out.status, issues: [], model: out.model, message: out.message };
    else {
      const settled = settleVerdict(out.parsed, text, input.facts);
      model = {
        ...settled,
        model: out.model,
        message: settled.status === "pass" ? "An AI read the letter against what you confirmed and found nothing to fix." : `An AI read the letter against what you confirmed and found ${settled.issues.length} ${settled.issues.length === 1 ? "line" : "lines"} to fix.`,
      };
    }
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
  await db
    .update(schema.applicationPacket)
    .set({ letterReview: result as unknown as Record<string, unknown> })
    .where(and(eq(schema.applicationPacket.userId, userId), eq(schema.applicationPacket.jobId, jobId)));
  await logEvent(userId, result.passed ? "letter_gate_passed" : "letter_gate_failed", {
    jobId,
    blocking: result.checks.filter((c) => c.blocking && !c.ok).map((c) => c.id),
    model: result.model.status,
  });
  return result;
}

