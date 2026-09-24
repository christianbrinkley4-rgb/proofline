"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { archiveExperience, ExperienceDetailsSchema, updateExperience, type ExperienceDetails } from "@/lib/kb/experiences";
import { addFact } from "@/lib/kb/facts";
import { archiveBullet, editBullet, generateBullets, listBullets, setBulletFavorite } from "@/lib/resume/bullets/service";
import { listOpenQuestions } from "@/lib/kb/questions";
import { experienceFromWords } from "@/lib/kb/story";

async function userId() {
  return (await requireSession()).user.id;
}

function refresh() {
  revalidatePath("/app", "layout");
}

export async function generateBulletsAction(experienceId: string) {
  const result = await generateBullets(await userId(), experienceId);
  refresh();
  return result;
}

export async function editBulletAction(bulletId: string, text: string) {
  await editBullet(await userId(), bulletId, text);
  refresh();
}

export async function favoriteBulletAction(bulletId: string, favorite: boolean) {
  await setBulletFavorite(await userId(), bulletId, favorite);
  refresh();
}

export async function archiveBulletAction(bulletId: string) {
  await archiveBullet(await userId(), bulletId);
  refresh();
}

export async function updateExperienceAction(
  experienceId: string,
  input: ExperienceDetails,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = ExperienceDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const row = await updateExperience(await userId(), z.uuid().parse(experienceId), {
    kind: v.kind,
    org: v.org,
    title: v.title || null,
    location: v.location || null,
    startDate: v.startDate || null,
    endDate: v.endDate || null,
  });
  if (!row) return { ok: false, error: "That experience is no longer on your profile." };
  refresh();
  return { ok: true };
}

/** Hidden from the profile, matching, and new resumes. Sent resumes keep their copy. */
export async function archiveExperienceAction(experienceId: string) {
  await archiveExperience(await userId(), z.uuid().parse(experienceId));
  refresh();
}

const SpokenSchema = z.object({
  text: z.string().trim().min(20, "Say a little more: what you did, how much or how often, and what changed.").max(8000),
  org: z.string().trim().min(1, "Where was this? A job, club, class, or project name.").max(160),
  title: z.string().trim().max(160),
  kind: z.enum(["work", "internship", "leadership", "project", "volunteer", "research"]),
});

export type SpokenExperience = z.infer<typeof SpokenSchema>;
export type ExperienceDrafts = {
  experienceId: string;
  bullets: Array<{ id: string; text: string; score: number | null; ready: boolean }>;
  questions: Array<{ id: string; prompt: string; kind: string }>;
  method: "model" | "rules";
};

async function drafts(userId: string, experienceId: string, method: "model" | "rules"): Promise<ExperienceDrafts> {
  const [bullets, questions] = await Promise.all([listBullets(userId, [experienceId]), listOpenQuestions(userId, { experienceId })]);
  return {
    experienceId,
    method,
    bullets: bullets.map((b) => ({ id: b.id, text: b.text, score: b.score, ready: b.status === "active" })),
    questions: questions.filter((q) => q.kind !== "yes_no").map((q) => ({ id: q.id, prompt: q.prompt, kind: q.kind })),
  };
}

/**
 * Something the student said out loud becomes an experience: their statements are
 * confirmed facts (they said them), bullets are written in X-Y-Z form, and every
 * missing number comes back as a question instead of a guess.
 */
export async function speakExperienceAction(input: SpokenExperience): Promise<({ ok: true } & ExperienceDrafts) | { ok: false; error: string }> {
  const parsed = SpokenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const id = await userId();
  const { experienceId } = await experienceFromWords(id, { ...parsed.data, notes: parsed.data.text, via: "voice" });
  const result = await generateBullets(id, experienceId);
  refresh();
  return { ok: true, ...(await drafts(id, experienceId, result.method)) };
}

/** After the student answers the follow-up questions: rewrite with their numbers. */
export async function rewriteWithAnswersAction(experienceId: string): Promise<ExperienceDrafts> {
  const id = await userId();
  const expId = z.uuid().parse(experienceId);
  const result = await generateBullets(id, expId);
  // A rewrite with the student's numbers replaces the weaker draft of the same statement,
  // unless they starred or edited it themselves.
  const byStatement = new Map<string, Awaited<ReturnType<typeof listBullets>>>();
  for (const b of await listBullets(id, [expId])) {
    const key = b.factIds[0];
    if (key) byStatement.set(key, [...(byStatement.get(key) ?? []), b]);
  }
  for (const group of byStatement.values()) {
    // Keep drafts awaiting approval visible. Among approved versions, prefer the
    // one backed by more facts (the student's new answer), then its score.
    const approved = group.filter((b) => b.status === "active");
    const [best, ...rest] = approved.sort((a, b) =>
      b.factIds.length - a.factIds.length || (b.score ?? 0) - (a.score ?? 0),
    );
    for (const b of rest) if (best && !b.favorite && b.generator !== "user" && !b.editedFromId) await archiveBullet(id, b.id);
  }
  refresh();
  return drafts(id, expId, result.method);
}

const FactSchema = z.object({
  content: z.string().trim().min(3),
  experienceId: z.string().uuid().nullable(),
  category: z.enum(["experience", "metric", "skill", "tool", "award", "certification", "education", "project", "other"]),
});

/** A fact the student types is theirs, so it's stored as confirmed. */
export async function addFactAction(input: z.infer<typeof FactSchema>) {
  const parsed = FactSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Write a few words." };
  await addFact(await userId(), { ...parsed.data, source: "user_stated", sourceDetail: "profile" });
  refresh();
  return { ok: true as const };
}
