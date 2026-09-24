"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { archiveExperience, ExperienceDetailsSchema, updateExperience, type ExperienceDetails } from "@/lib/kb/experiences";
import { addFact } from "@/lib/kb/facts";
import { archiveBullet, editBullet, generateBullets, setBulletFavorite } from "@/lib/resume/bullets/service";

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
