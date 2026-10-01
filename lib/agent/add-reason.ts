import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { saveWhy } from "@/lib/packet/service";
import { findLetterFiller } from "@/lib/voice/rules";
import type { LoopStep } from "./loop";
import { letterStep, packageLetter, type LetterOutcome } from "./package-letter";

export type AddReasonResult = { ok: true; status: "ready" | "needs_you"; reason: string | null } | { ok: false; error: string };

const Reason = z.string().trim().min(20, "Write a sentence or two. A few words won't read as yours.").max(600, "Keep it to a couple of sentences, under 600 characters.");

/**
 * The person's own reason for wanting a job, for a role waiting on it. It is saved
 * as written (Proofline never composes it), the cover letter is rebuilt around it
 * and reviewed again, and the role becomes ready if both documents now pass.
 */
export async function addReasonToRun(userId: string, runId: string, why: string, deps: { letter: (userId: string, jobId: string) => Promise<LetterOutcome> } = { letter: packageLetter }): Promise<AddReasonResult> {
  const parsed = Reason.safeParse(why);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Write a sentence or two first." };
  const filler = findLetterFiller(parsed.data);
  if (filler.length) return { ok: false, error: `"${filler[0]}" reads like a template. Say what you actually like about this job, in plain words.` };

  const run = await db.query.agentRun.findFirst({
    where: and(eq(schema.agentRun.id, runId), eq(schema.agentRun.userId, userId), eq(schema.agentRun.status, "needs_you"), isNull(schema.agentRun.dismissedAt)),
  });
  // Only a role whose resume already passed and whose letter is waiting on the reason may become ready here.
  const trail = run?.steps as unknown as LoopStep[] | undefined;
  if (!run || !trail?.some((s) => s.step === "letter" && !s.ok && s.needs === "why") || trail.some((s) => s.step === "review" && !s.ok)) {
    return { ok: false, error: "That role isn't waiting on a reason anymore. Reload the page." };
  }

  await saveWhy(userId, run.jobId, parsed.data);
  const outcome = await deps.letter(userId, run.jobId);
  const steps = trail.filter((s) => s.step !== "letter");
  steps.push(letterStep(outcome, new Date().toISOString()));
  if (outcome.ok) {
    await db.update(schema.agentRun).set({ status: "ready", reason: null, steps, updatedAt: new Date() }).where(eq(schema.agentRun.id, run.id));
    return { ok: true, status: "ready", reason: null };
  }
  await db.update(schema.agentRun).set({ reason: outcome.reason, steps, updatedAt: new Date() }).where(eq(schema.agentRun.id, run.id));
  return { ok: true, status: "needs_you", reason: outcome.reason };
}
