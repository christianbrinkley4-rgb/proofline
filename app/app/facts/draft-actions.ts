"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { addBulletFact, deleteFact } from "@/lib/facts/base";
import { getExperience, updateExperience } from "@/lib/kb/experiences";
import { unsupportedNumbers } from "@/lib/resume/draft-bullets";
import { rolePromptIdeas } from "@/lib/resume/onet-prompts";
import { dashesToCommas, findVoiceIssues } from "@/lib/voice/rules";

export type KeepResult = { ok: true; factId: string; text: string } | { ok: false; error: string };

const KeepSchema = z.object({
  experienceId: z.uuid(),
  text: z.string().trim().min(3, "Write the line first.").max(400, "Keep it to one resume line, under 400 characters."),
  /**
   * draft: a recommended line they kept as is. resume: a line read from their own resume.
   * edited and own: words they wrote themselves.
   */
  origin: z.enum(["draft", "resume", "edited", "own"]),
  /** What the person typed that the line came from: their description and any answer. */
  sources: z.array(z.string().max(4000)).max(4).default([]),
  confirmed: z.literal(true, "Keep or edit the line to confirm it's true."),
});

/**
 * Keep (or Edit) on a recommended line. This is the moment a draft becomes a
 * confirmed fact that a resume may use. A kept draft may not carry a number the
 * person never typed; a line they wrote or edited is theirs to vouch for.
 */
export async function keepLineAction(input: z.input<typeof KeepSchema>): Promise<KeepResult> {
  const parsed = KeepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the line." };
  const userId = (await requireSession()).user.id;
  const { experienceId, origin, sources } = parsed.data;
  // Dashes in someone's own words become commas, the same as every other line on the page.
  const text = dashesToCommas(parsed.data.text).replace(/\s+/g, " ").trim();
  const experience = await getExperience(userId, experienceId);
  if (!experience || experience.archivedAt) return { ok: false, error: "That role isn't on your profile anymore." };
  if ((origin === "draft" || origin === "resume") && unsupportedNumbers(text, sources).length) {
    return { ok: false, error: "That line has a number you didn't give us. Edit it so every number is yours." };
  }
  const voice = findVoiceIssues(text).find((issue) => issue.rule === "banned-phrase");
  if (voice) return { ok: false, error: `Say it more plainly than "${voice.match}". Recruiters skim past words like that.` };
  try {
    const saved = await addBulletFact(userId, experience, text, `kept-${origin}`);
    if (!saved) return { ok: false, error: "Write a little more for this line." };
    revalidatePath("/app", "layout");
    return { ok: true, factId: saved.fact.id, text: saved.fact.content };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't save that line. Try again." };
  }
}

/** Undo a Keep: the line comes off every resume, the same as deleting it on My experience. */
export async function undoKeepAction(factId: string): Promise<{ ok: boolean }> {
  const userId = (await requireSession()).user.id;
  const id = z.uuid().safeParse(factId);
  if (!id.success) return { ok: false };
  await deleteFact(userId, id.data);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Keeps what they said a role involved, so they can draft from it again later. Never shown on a resume. */
export async function saveRoleNotesAction(experienceId: string, notes: string): Promise<void> {
  const userId = (await requireSession()).user.id;
  const id = z.uuid().safeParse(experienceId);
  if (!id.success) return;
  await updateExperience(userId, id.data, { rawNotes: notes.trim().slice(0, 4000) || null });
}

/**
 * Lines that are common in this kind of job, from the role's title. They are
 * questions, never claims: nothing is saved until the person says they did it and
 * confirms the wording. A template with a blank to fill in is left out. The
 * templates are all past tense, so a current role keeps them whole rather than
 * changing only the first verb.
 */
export async function roleIdeasAction(experienceId: string, count = 3): Promise<string[]> {
  const userId = (await requireSession()).user.id;
  const id = z.uuid().safeParse(experienceId);
  if (!id.success) return [];
  const experience = await getExperience(userId, id.data);
  if (!experience || experience.archivedAt) return [];
  return rolePromptIdeas(experience.title?.trim() || experience.org, null, 12)
    .filter((idea) => !/\[[^\]]*\]/.test(idea.template))
    .slice(0, Math.max(1, Math.min(5, Math.floor(count))))
    .map((idea) => idea.template);
}
