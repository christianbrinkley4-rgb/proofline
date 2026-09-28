"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logEvent } from "@/lib/agent/events";
import { requireSession } from "@/lib/auth";
import { addBulletFact, addListFacts, saveRole } from "@/lib/facts/base";
import { skillFromAnswer } from "@/lib/fit/gaps";
import { getJobForUser } from "@/lib/jobs/store";
import { createExperience, getExperience } from "@/lib/kb/experiences";
import { runGate, type GateResult } from "@/lib/review/gate";
import { getResume } from "@/lib/resume/store";
import { tailorBestResume } from "@/lib/resume/tailor-best";

export type TailorActionResult = { ok: true; resumeId: string; gate: Pick<GateResult, "passed"> } | { ok: false; error: string };

async function buildAndReview(userId: string, email: string, jobId: string): Promise<TailorActionResult> {
  const data = await getJobForUser(userId, jobId);
  if (!data) return { ok: false, error: "This job isn't available to your account." };
  const built = await tailorBestResume(userId, data.job, email);
  if (!built.ok) return built;
  const stored = await getResume(userId, built.resumeId);
  const gate = stored ? await runGate(userId, stored) : null;
  revalidatePath(`/app/jobs/${jobId}`);
  return { ok: true, resumeId: built.resumeId, gate: { passed: gate?.passed ?? false } };
}

/** Builds the one best resume for this job from confirmed facts, then runs the review gate. */
export async function tailorJobAction(jobId: string): Promise<TailorActionResult> {
  const session = await requireSession();
  const id = z.uuid().safeParse(jobId);
  if (!id.success) return { ok: false, error: "That job link isn't valid." };
  try {
    return await buildAndReview(session.user.id, session.user.email, id.data);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't build the resume. Try again." };
  }
}

/** The "Re-run review" button: linter again, and one model call if the linter allows it. */
export async function rerunReviewAction(resumeId: string): Promise<{ ok: true; passed: boolean } | { ok: false; error: string }> {
  const session = await requireSession();
  const stored = await getResume(session.user.id, z.uuid().parse(resumeId));
  if (!stored) return { ok: false, error: "That resume isn't on your account anymore." };
  const gate = await runGate(session.user.id, stored);
  if (stored.row.jobId) revalidatePath(`/app/jobs/${stored.row.jobId}`);
  return { ok: true, passed: gate.passed };
}

const GapSchema = z.object({
  jobId: z.uuid(),
  skill: z.string().trim().min(1).max(160),
  experienceId: z.uuid().nullable(),
  newPlace: z.object({ org: z.string().trim().min(1, "Where was this?").max(160), kind: z.enum(["work", "internship", "project", "leadership", "volunteer", "research"]) }).nullable(),
  text: z.string().trim().min(15, "Say a little more: what you did, and any number you remember.").max(400, "Keep it to one resume line, under 400 characters."),
  confirmed: z.literal(true, "Tick the box to confirm this is true and in your own words."),
});

/**
 * A gap question answered and confirmed. The answer, in the person's exact words,
 * becomes a fact (and its resume line); the skill they named becomes a fact too.
 * Then the resume rebuilds and the review runs again.
 */
export async function answerGapQuestionAction(input: z.input<typeof GapSchema>): Promise<TailorActionResult> {
  const parsed = GapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your answer." };
  const { jobId, skill, experienceId, newPlace, text } = parsed.data;
  const session = await requireSession();
  const userId = session.user.id;
  if (!(await getJobForUser(userId, jobId))) return { ok: false, error: "This job isn't available anymore." };
  const used = skillFromAnswer(skill, text);
  if (!used) return { ok: false, error: `Name ${skill.split(/\s+or\s+/i)[0]} in your answer if that's what you did. If you haven't done it, choose Not yet instead.` };

  const experience = experienceId ? await getExperience(userId, experienceId) : newPlace ? await createExperience(userId, { kind: newPlace.kind, org: newPlace.org }) : undefined;
  if (!experience || experience.archivedAt) return { ok: false, error: "Pick where you did this." };
  if (!experienceId && newPlace) {
    // A new place gets its name recorded as a fact, in the person's words.
    await saveRole(userId, { experienceId: experience.id, kind: experience.kind, org: newPlace.org, title: "", startDate: "", endDate: "", bullets: [] }, `gap:${jobId}`);
  }
  await addBulletFact(userId, experience, text, `gap:${jobId}`);
  await addListFacts(userId, "skill", [used], `gap:${jobId}`);
  await logEvent(userId, "gap_answered", { jobId, skill, used, experienceId: experience.id });
  return buildAndReview(userId, session.user.email, jobId);
}
