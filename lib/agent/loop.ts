import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { scoringReady } from "@/lib/facts/base";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { checkKnockouts, firstKnockout, knockoutCandidate } from "@/lib/fit/knockouts";
import { hasUsableJobDescription } from "@/lib/jobs/description";
import { loadFeed, type FeedItem } from "@/lib/jobs/feed/load";
import { checkPostingOpen, LIVE_CHECKABLE, type LiveCheck } from "@/lib/jobs/feed/verify-live";
import { keywordsOf, requirementsOf, saveMatches, setMatchStatus, type JobRow } from "@/lib/jobs/store";
import { getProfile } from "@/lib/kb/profile";
import { getResume } from "@/lib/resume/store";
import { tailorBestResume, type TailorOutcome } from "@/lib/resume/tailor-best";
import { blockingFailures, readyBarFailures } from "@/lib/review/linter";
import { runGate, type GateResult } from "@/lib/review/gate";
import { trackJob } from "@/lib/tracker/service";
import { dealBreakerMatches } from "./learn";
import { packageLetter, type LetterOutcome } from "./package-letter";
import { logEvent } from "./events";

/**
 * The assisted loop for one person: take the best-fitting open roles from the feed
 * and, for each one, check the posting is still live, check it against their
 * dealbreakers and standing rules, save it to the tracker, build the resume from
 * confirmed facts, run the review gate, then draft the cover letter and review it the
 * same way. Every stage is written down as it
 * happens, so the person reads why a role is ready or why it stopped.
 *
 * It never submits anything and never writes a fact. A role is "ready" when its
 * resume and its cover letter both passed review; the person still reads them, fills
 * in the application, and presses the button themselves. The one thing it cannot do
 * for them is say why they want the job, so a role waiting on that is "needs you".
 */

export type StepName = "found" | "live" | "fit" | "track" | "resume" | "review" | "letter";
export type LoopStep = { step: StepName; ok: boolean; note: string; at: string; /** The person has to write something before this step can pass. */ needs?: "why" };

export type RunStatus = "running" | "ready" | "needs_you" | "skipped" | "unconfirmed";

/** Roles taken all the way through resume, letter, and review in one pass. Each role is two review model calls. */
export const ROLES_PER_RUN = 3;
/** Roles started per person per day, so a stuck loop can't spend the review budget. */
export const ROLES_PER_DAY = 9;
/** A run still marked running after this long crashed; the role can be picked up again. */
const STALE_RUNNING_MS = 10 * 60_000;

/**
 * Stop starting new roles after this long. A role can make two review calls of up to
 * 25 seconds each, so one that starts at the deadline still ends inside the page's
 * 120 second limit.
 */
const RUN_TIME_MS = 60_000;

const SOURCE_LABEL: Record<string, string> = { greenhouse: "Greenhouse" };

export type LoopDeps = {
  checkLive: (source: JobRow["source"], sourceId: string) => Promise<LiveCheck>;
  tailor: (userId: string, job: JobRow, email: string) => Promise<TailorOutcome>;
  review: (userId: string, resumeId: string) => Promise<GateResult | null>;
  letter: (userId: string, jobId: string) => Promise<LetterOutcome>;
  now: () => Date;
};

const defaultDeps: LoopDeps = {
  checkLive: checkPostingOpen,
  tailor: tailorBestResume,
  review: async (userId, resumeId) => {
    const stored = await getResume(userId, resumeId);
    return stored ? runGate(userId, stored) : null;
  },
  letter: packageLetter,
  now: () => new Date(),
};

export type LoopSummary = {
  /** Why nothing could start, when that is the case. */
  blocked: string | null;
  looked: number;
  ready: number;
  needsYou: number;
  skipped: number;
  unconfirmed: number;
};

/** One plain sentence on why a review did not pass, from the checks the person can act on. */
export function reviewFailureReason(gate: GateResult): string {
  const blocked = blockingFailures(gate.linter);
  if (blocked.length === 1) return blocked[0].detail || `Fix first: ${blocked[0].label.toLowerCase()}.`;
  if (blocked.length) return `Fix ${blocked.length} things first: ${blocked.map((c) => c.label.toLowerCase()).join("; ")}.`;
  if (gate.model.status === "fail") return `The final read-through flagged ${gate.model.issues.length === 1 ? "a line" : `${gate.model.issues.length} lines`} to fix.`;
  return gate.model.message || "The review could not finish. Check it again from the job page.";
}

/**
 * Why a resume that passed the download gate is still not ready: formatting a
 * finished resume cannot get wrong (see READY_BAR), because nobody reads it first.
 */
export function readyBarReason(gate: GateResult): string | null {
  const failed = readyBarFailures(gate.linter);
  if (!failed.length) return null;
  if (failed.length === 1) return failed[0].detail || `Fix first: ${failed[0].label.toLowerCase()}.`;
  return `Fix ${failed.length} things before it counts as ready: ${failed.map((c) => c.label.toLowerCase()).join("; ")}.`;
}

const step = (name: StepName, ok: boolean, note: string, at: Date): LoopStep => ({ step: name, ok, note, at: at.toISOString() });

/** Takes the role if nobody else has it; a crashed or unreachable earlier try may be picked up again. */
async function claim(userId: string, jobId: string, started: Date): Promise<string | null> {
  const stale = new Date(started.getTime() - STALE_RUNNING_MS);
  const [row] = await db
    .insert(schema.agentRun)
    .values({ userId, jobId, status: "running", steps: [] })
    .onConflictDoUpdate({
      target: [schema.agentRun.userId, schema.agentRun.jobId],
      set: { status: "running", reason: null, steps: [], resumeId: null, updatedAt: started },
      setWhere: or(eq(schema.agentRun.status, "unconfirmed"), and(eq(schema.agentRun.status, "running"), lt(schema.agentRun.updatedAt, stale))),
    })
    .returning({ id: schema.agentRun.id });
  return row?.id ?? null;
}

async function finish(runId: string, status: Exclude<RunStatus, "running">, reason: string | null, steps: LoopStep[], links: { resumeId?: string | null; applicationId?: string | null } = {}) {
  await db
    .update(schema.agentRun)
    .set({ status, reason, steps, resumeId: links.resumeId ?? null, applicationId: links.applicationId ?? null, updatedAt: new Date() })
    .where(eq(schema.agentRun.id, runId));
}

type RoleOutcome = Exclude<RunStatus, "running">;

/** One role from the live check to the review gate. Always records where it ended. */
async function runRole(userId: string, email: string, runId: string, job: JobRow, item: FeedItem, steps: LoopStep[], ctx: { candidate: Awaited<ReturnType<typeof loadCandidate>>; profile: Awaited<ReturnType<typeof getProfile>> }, deps: LoopDeps): Promise<RoleOutcome> {
  steps.push(step("found", true, `Fit score ${item.score} against your confirmed facts.`, deps.now()));
  const stop = async (status: Exclude<RoleOutcome, "ready">, reason: string, links: { applicationId?: string | null; resumeId?: string | null } = {}): Promise<RoleOutcome> => {
    await finish(runId, status, reason, steps, links);
    return status;
  };

  const live = await deps.checkLive(job.source, job.sourceId);
  if (live === "closed") {
    steps.push(step("live", false, `${job.company}'s job board no longer lists it.`, deps.now()));
    await db.update(schema.job).set({ listedAt: null, closedAt: deps.now() }).where(eq(schema.job.id, job.id));
    return stop("skipped", "The employer took this posting down.");
  }
  if (live === "unconfirmed") {
    steps.push(step("live", false, `Couldn't reach ${job.company}'s job board to confirm it is open.`, deps.now()));
    return stop("unconfirmed", "Couldn't confirm the posting is still open. It will be checked again on the next run.");
  }
  steps.push(step("live", true, `Open on ${SOURCE_LABEL[job.source] ?? job.source} just now.`, deps.now()));

  if (!hasUsableJobDescription(job.description)) {
    steps.push(step("fit", false, "The posting has no readable description.", deps.now()));
    return stop("skipped", "No description to build a resume against.");
  }
  if (dealBreakerMatches(ctx.profile?.dealBreakers ?? [], job)) {
    steps.push(step("fit", false, "Matches one of your dealbreakers.", deps.now()));
    return stop("skipped", "Matches one of your dealbreakers.");
  }
  const knockout = firstKnockout(
    checkKnockouts({ title: job.title, location: job.location, mode: job.mode, description: job.description, requirements: requirementsOf(job) }, knockoutCandidate(ctx.profile)),
  );
  if (knockout) {
    steps.push(step("fit", false, knockout.reason, deps.now()));
    return stop("skipped", knockout.reason);
  }
  steps.push(step("fit", true, "No dealbreakers and no knockouts.", deps.now()));

  // Saved before the resume exists, so a role that stops later is still on the tracker with the reason.
  const fit = scoreFit({ title: job.title, location: job.location, mode: job.mode, level: job.level, requirements: requirementsOf(job), keywords: keywordsOf(job) }, ctx.candidate);
  await saveMatches(userId, [{ job, fit }]);
  await setMatchStatus(userId, job.id, "saved");
  let application = await trackJob(userId, job.id);
  steps.push(step("track", true, "Saved to Applications.", deps.now()));

  const built = await deps.tailor(userId, job, email);
  if (!built.ok) {
    steps.push(step("resume", false, built.error, deps.now()));
    return stop("needs_you", built.error, { applicationId: application.id });
  }
  steps.push(step("resume", true, "Built from your confirmed facts only.", deps.now()));

  const gate = await deps.review(userId, built.resumeId);
  const reason = !gate ? "The resume could not be read back for review." : !gate.passed ? reviewFailureReason(gate) : readyBarReason(gate);
  if (reason) {
    steps.push(step("review", false, reason, deps.now()));
    return stop("needs_you", reason, { applicationId: application.id, resumeId: built.resumeId });
  }
  steps.push(step("review", true, `The resume passed every check. ${gate!.model.message}`, deps.now()));
  // The resume is good whatever happens to the letter, so it goes on the tracker now.
  application = await trackJob(userId, job.id, { resumeId: built.resumeId });

  const letter = await deps.letter(userId, job.id);
  if (!letter.ok) {
    steps.push({ ...step("letter", false, letter.reason, deps.now()), ...(letter.needs ? { needs: letter.needs } : {}) });
    return stop("needs_you", letter.reason, { applicationId: application.id, resumeId: built.resumeId });
  }
  steps.push(step("letter", true, "The cover letter passed the review against your facts and this posting.", deps.now()));
  await finish(runId, "ready", null, steps, { applicationId: application.id, resumeId: built.resumeId });
  return "ready";
}

/** Roles started today, for the daily cap. */
async function startedToday(userId: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - 864e5);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.agentRun)
    .where(and(eq(schema.agentRun.userId, userId), sql`${schema.agentRun.createdAt} > ${since}`));
  return row?.n ?? 0;
}

export async function runLoop(userId: string, email: string, opts: { limit?: number; deps?: Partial<LoopDeps> } = {}): Promise<LoopSummary> {
  const deps: LoopDeps = { ...defaultDeps, ...opts.deps };
  const limit = opts.limit ?? ROLES_PER_RUN;
  const summary: LoopSummary = { blocked: null, looked: 0, ready: 0, needsYou: 0, skipped: 0, unconfirmed: 0 };

  const readiness = await scoringReady(userId);
  if (!readiness.ready) {
    summary.blocked = `Add your ${readiness.hasEducation ? "first role" : "school"} in My experience first. Resumes are made only from what you have confirmed.`;
    return summary;
  }
  const now = deps.now();
  if ((await startedToday(userId, now)) >= ROLES_PER_DAY) {
    summary.blocked = "That's the most roles Proofline will work through for you in one day. Come back tomorrow, or open any role from Find jobs yourself.";
    return summary;
  }

  const [feed, candidate, profile, tracked, runs] = await Promise.all([
    loadFeed(userId, { limit: 80, now }),
    loadCandidate(userId),
    getProfile(userId),
    db.select({ jobId: schema.application.jobId }).from(schema.application).where(eq(schema.application.userId, userId)),
    db.select({ jobId: schema.agentRun.jobId, status: schema.agentRun.status }).from(schema.agentRun).where(eq(schema.agentRun.userId, userId)),
  ]);
  const skip = new Set<string>([...tracked.flatMap((t) => (t.jobId ? [t.jobId] : [])), ...runs.filter((r) => r.status !== "unconfirmed").map((r) => r.jobId)]);

  // Only boards with a single-posting check can be confirmed live; the rest stay in Find jobs.
  const items = feed.items.filter((i) => !i.knockout && !skip.has(i.jobId));
  const rows = items.length ? await db.select().from(schema.job).where(inArray(schema.job.id, items.map((i) => i.jobId))) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const queue = items.flatMap((item) => {
    const job = byId.get(item.jobId);
    return job && LIVE_CHECKABLE.includes(job.source) && job.closedAt === null ? [{ item, job }] : [];
  });

  await logEvent(userId, "loop_started", { candidates: queue.length });
  const budget = Math.min(limit, ROLES_PER_DAY);
  const deadline = Date.now() + RUN_TIME_MS;
  let unreachable = 0;
  for (const { item, job } of queue) {
    if (summary.ready + summary.needsYou >= budget || Date.now() > deadline) break;
    // Three boards in a row that won't answer means the network is the problem, not the postings.
    if (unreachable >= 3) {
      summary.blocked = "Couldn't reach the employers' job boards just now. Nothing was changed; try again in a few minutes.";
      break;
    }
    const runId = await claim(userId, job.id, now);
    if (!runId) continue;
    summary.looked++;
    const steps: LoopStep[] = [];
    let outcome: RoleOutcome;
    try {
      outcome = await runRole(userId, email, runId, job, item, steps, { candidate, profile }, deps);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Something went wrong with this role.";
      steps.push(step("resume", false, reason, deps.now()));
      await finish(runId, "needs_you", reason, steps);
      outcome = "needs_you";
    }
    unreachable = outcome === "unconfirmed" ? unreachable + 1 : 0;
    if (outcome === "ready") summary.ready++;
    else if (outcome === "needs_you") summary.needsYou++;
    else if (outcome === "skipped") summary.skipped++;
    else summary.unconfirmed++;
  }
  const { blocked, ...counts } = summary;
  await logEvent(userId, "loop_finished", { ...counts, stopped: blocked });
  return summary;
}
