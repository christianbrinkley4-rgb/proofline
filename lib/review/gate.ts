import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { logEvent } from "@/lib/agent/events";
import { db, schema } from "@/lib/db";
import { confirmedFactTexts } from "@/lib/facts/base";
import { keywordsOf, requirementsOf } from "@/lib/jobs/store";
import { layoutResume, PAGE, type LayoutResult } from "@/lib/resume/layout";
import type { StoredResume } from "@/lib/resume/store";
import { blockingFailures, lintResume, type LintCheck } from "./linter";
import { reviewByConsensus } from "./consensus";
import { RESUME_FRAMINGS } from "./framings";
import { buildReviewInput, type ModelReview } from "./model";
import { resumeLines, resumeToText } from "./resume-text";

/**
 * The review gate: nothing exports until every BLOCKING linter check passes and
 * independent model reviewers (see consensus.ts) all pass exactly this resume
 * against exactly these facts.
 * The verdict is stored with a fingerprint; any change to the resume, the facts,
 * or the posting invalidates it, and export re-runs the linter itself.
 */

export type GateResult = {
  version: 1;
  fingerprint: string;
  linter: LintCheck[];
  model: ModelReview;
  passed: boolean;
  at: string;
};

/** Pages the content needs, from the layout engine's real font metrics. */
export function pagesNeeded(layout: LayoutResult, margin: number): number {
  if (!layout.overflow) return 1;
  return 1 + Math.ceil(-layout.remaining / (PAGE.height - 2 * margin));
}

type Inputs = { resumeText: string; facts: string[]; jobDescription: string; requirements: string; keywords: string[]; pageCount: number; fingerprint: string };

async function gather(userId: string, stored: StoredResume, layout?: LayoutResult): Promise<Inputs> {
  const [facts, job, measured] = await Promise.all([
    confirmedFactTexts(userId),
    stored.row.jobId ? db.query.job.findFirst({ where: eq(schema.job.id, stored.row.jobId) }) : Promise.resolve(undefined),
    layout ? Promise.resolve(layout) : layoutResume(stored.document, stored.template),
  ]);
  const resumeText = resumeToText(stored.document);
  const req = job ? requirementsOf(job) : null;
  const requirements = req ? [...req.requiredLines.map((l) => `- ${l}`), ...(req.preferredLines.length ? ["Preferred:", ...req.preferredLines.map((l) => `- ${l}`)] : [])].join("\n") : "";
  const jobDescription = job?.description ?? "";
  const fingerprint = createHash("sha256").update([resumeText, [...facts].sort().join("\n"), jobDescription].join("\n\u0000\n")).digest("hex");
  return {
    resumeText,
    facts,
    jobDescription,
    requirements: requirements || jobDescription.slice(0, 2400),
    keywords: job ? keywordsOf(job) : [],
    pageCount: pagesNeeded(measured, stored.template.margin),
    fingerprint,
  };
}

function lint(inputs: Inputs) {
  return lintResume({ resumeText: inputs.resumeText, jobDescription: inputs.jobDescription, userFacts: inputs.facts, keywords: inputs.keywords, pageCount: inputs.pageCount });
}

/** Independent reviewers read the resume (see consensus.ts). The contact line never leaves the database. */
function reviewResume(userId: string, inputs: Inputs, resumeText: string): Promise<ModelReview> {
  return reviewByConsensus(userId, {
    purpose: "review.gate",
    framings: RESUME_FRAMINGS,
    input: buildReviewInput({ requirements: inputs.requirements, resumeText, facts: inputs.facts }),
    text: resumeText,
    facts: inputs.facts,
    noun: "resume",
  });
}

/** Runs the whole gate (linter, then the model reviewers if the linter allows), stores it, and logs the outcome. */
export async function runGate(userId: string, stored: StoredResume): Promise<GateResult> {
  const inputs = await gather(userId, stored);
  const linter = lint(inputs);
  const blocked = blockingFailures(linter);
  const model: ModelReview = blocked.length
    ? { status: "skipped", issues: [], model: null, message: "The final read-through runs once everything marked Must fix is fixed." }
    : await reviewResume(userId, inputs, resumeLines(stored.document).filter((l) => l.kind !== "contact").map((l) => l.text).join("\n"));
  const result: GateResult = { version: 1, fingerprint: inputs.fingerprint, linter, model, passed: !blocked.length && model.status === "pass", at: new Date().toISOString() };
  await db.update(schema.resume).set({ review: result as unknown as Record<string, unknown> }).where(eq(schema.resume.id, stored.row.id));
  await logEvent(userId, result.passed ? "gate_passed" : "gate_failed", {
    resumeId: stored.row.id,
    jobId: stored.row.jobId,
    blocking: blocked.map((c) => c.id),
    model: model.status,
  });
  return result;
}

export type GateStatus = {
  /** The stored result, if it still applies to this exact resume and these facts. */
  review: GateResult | null;
  /** Linter results as of right now (cheap, always fresh). */
  linter: LintCheck[];
  /** True when the facts or resume changed since the last review. */
  stale: boolean;
  canExport: boolean;
  reason: string | null;
  /** Each resume line with the bullet and facts it came from, for sending the user to a flagged line. */
  lines: ReturnType<typeof resumeLines>;
};

/** What the Tailor tab and the export route both trust. No model call. */
export async function gateStatus(userId: string, stored: StoredResume, layout?: LayoutResult): Promise<GateStatus> {
  const inputs = await gather(userId, stored, layout);
  const linter = lint(inputs);
  const saved = (stored.row.review as unknown as GateResult | null) ?? null;
  const review = saved && saved.version === 1 && saved.fingerprint === inputs.fingerprint ? saved : null;
  const blocked = blockingFailures(linter);
  const reason = blocked.length
    ? `Fix ${blocked.length === 1 ? "one thing" : `${blocked.length} things`} first: ${blocked.map((c) => c.label.toLowerCase()).join("; ")}.`
    : !review
      ? saved
        ? "You changed something since the last check. Check it again to download."
        : "Check it to download."
      : review.model.status !== "pass"
        ? review.model.status === "fail"
          ? "The final read-through found lines to fix. They're highlighted on the page."
          : review.model.message
        : null;
  return { review, linter, stale: Boolean(saved && !review), canExport: reason === null, reason, lines: resumeLines(stored.document) };
}
