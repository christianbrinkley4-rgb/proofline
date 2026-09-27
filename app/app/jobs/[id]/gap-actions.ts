"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logEvent } from "@/lib/agent/events";
import { requireSession } from "@/lib/auth";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { skillFromAnswer } from "@/lib/fit/gaps";
import { getJobForUser, requirementsOf, saveMatches } from "@/lib/jobs/store";
import { createExperience, listExperiences } from "@/lib/kb/experiences";
import { addFact } from "@/lib/kb/facts";
import { editBullet, generateBullets, listBullets } from "@/lib/resume/bullets/service";
import { hasNumber } from "@/lib/resume/polish";

const KINDS = ["work", "internship", "project", "leadership", "volunteer", "research"] as const;

const AnswerSchema = z.object({
  jobId: z.uuid(),
  skill: z.string().trim().min(1).max(160),
  /** An experience already on the profile, or a new place described below. */
  experienceId: z.uuid().nullable(),
  newPlace: z.object({ org: z.string().trim().min(1, "Where was this?").max(160), kind: z.enum(KINDS) }).nullable(),
  text: z.string().trim().min(15, "Say a little more: what you did with it, and any number you remember.").max(2000),
});

export type GapAnswer = z.infer<typeof AnswerSchema>;
export type GapResult =
  | { ok: true; before: number; after: number; bullets: Array<{ text: string; ready: boolean }>; org: string }
  | { ok: false; error: string };

async function rescore(userId: string, jobId: string) {
  const data = await getJobForUser(userId, jobId);
  if (!data) return null;
  const fit = scoreFit(
    { title: data.job.title, location: data.job.location, mode: data.job.mode, level: data.job.level, requirements: requirementsOf(data.job) },
    await loadCandidate(userId),
  );
  await saveMatches(userId, [{ job: data.job, fit }]);
  return fit;
}

/**
 * The student says where they've done something the posting asks for. Their words
 * become confirmed facts (they said them), new bullets are written and checked
 * against those facts, and the fit is scored again so they see what changed.
 */
export async function answerGapAction(input: GapAnswer): Promise<GapResult> {
  const parsed = AnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your answer." };
  const { jobId, skill, experienceId, newPlace, text } = parsed.data;
  const session = await requireSession();
  const userId = session.user.id;

  const data = await getJobForUser(userId, jobId);
  if (!data) return { ok: false, error: "This job isn't available anymore." };
  const used = skillFromAnswer(skill, text);
  if (!used) return { ok: false, error: `Name ${skill} in your answer if that is what you did, and describe the task in your own words.` };
  const before = data.match?.fitScore ?? (await rescore(userId, jobId))?.score ?? 0;

  let expId = experienceId;
  let org = newPlace?.org ?? "";
  if (expId) {
    const experience = (await listExperiences(userId)).find((e) => e.id === expId);
    if (!experience) return { ok: false, error: "Pick one of your experiences, or add a new place." };
    org = experience.org;
  } else if (newPlace) {
    expId = (await createExperience(userId, { kind: newPlace.kind, org: newPlace.org })).id;
  } else {
    return { ok: false, error: "Pick where you did this." };
  }

  const started = new Date();
  await addFact(userId, { category: "experience", content: text, experienceId: expId, source: "user_stated", sourceDetail: `gap:${jobId}` });
  await addFact(userId, { category: "skill", content: used, experienceId: null, source: "user_stated", sourceDetail: `gap:${jobId}` });
  await generateBullets(userId, expId, [used]);
  const fresh = (await listBullets(userId, [expId])).filter((b) => b.createdAt >= started);

  const after = (await rescore(userId, jobId))?.score ?? before;
  await logEvent(userId, "gap_answered", { jobId, skill, used, experienceId: expId, before, after });
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app");
  return { ok: true, before, after, org, bullets: fresh.map((b) => ({ text: b.text, ready: b.status === "active" })) };
}

/** "I haven't done this yet." Remembered for every job, until they answer it later. */
export async function declineGapAction(input: { jobId: string; skill: string }): Promise<{ ok: boolean }> {
  const parsed = z.object({ jobId: z.uuid(), skill: z.string().trim().min(1).max(160) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const session = await requireSession();
  await logEvent(session.user.id, "gap_declined", parsed.data);
  revalidatePath(`/app/jobs/${parsed.data.jobId}`);
  revalidatePath("/app");
  return { ok: true };
}

/** Undo a "not yet": the skill comes back as an open question. */
export async function reopenGapAction(input: { jobId: string; skill: string }): Promise<{ ok: boolean }> {
  const parsed = z.object({ jobId: z.uuid(), skill: z.string().trim().min(1).max(160) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const session = await requireSession();
  // An answered event clears the decline; the skill has no fact yet, so it shows as a gap again.
  await logEvent(session.user.id, "gap_answered", { ...parsed.data, reopened: true });
  revalidatePath(`/app/jobs/${parsed.data.jobId}`);
  return { ok: true };
}

/**
 * The student rewrites one bullet with the number it was missing. Their full
 * revision becomes a confirmed fact and replaces the old bullet everywhere.
 */
export async function measureBulletAction(input: { jobId: string; bulletId: string; text: string }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const parsed = z.object({ jobId: z.uuid(), bulletId: z.uuid(), text: z.string().trim().min(15).max(400) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write the full bullet, with the number in it." };
  if (!hasNumber(parsed.data.text)) return { ok: false, error: "Add the number: how many, how much, how often, or how fast." };
  const session = await requireSession();
  const row = await editBullet(session.user.id, parsed.data.bulletId, parsed.data.text);
  if (!row) return { ok: false, error: "That bullet isn't on your profile anymore." };
  revalidatePath(`/app/jobs/${parsed.data.jobId}`);
  revalidatePath("/app");
  return { ok: true, text: row.text };
}
