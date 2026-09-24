"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { CoverLetterSchema, type CoverLetter } from "@/lib/packet/cover-letter";
import { draftCoverLetter, saveCoverLetter, saveInterviewNote, saveWhy } from "@/lib/packet/service";

const JobId = z.uuid();

function refresh(jobId: string) {
  revalidatePath(`/app/jobs/${jobId}/packet`);
}

export async function draftCoverLetterAction(jobId: string, why?: string) {
  const session = await requireSession();
  const id = JobId.parse(jobId);
  const letter = await draftCoverLetter(session.user.id, id, why === undefined ? undefined : z.string().max(1200).parse(why));
  refresh(id);
  return letter;
}

export async function saveCoverLetterAction(jobId: string, letter: CoverLetter) {
  const session = await requireSession();
  const id = JobId.parse(jobId);
  const saved = await saveCoverLetter(session.user.id, id, CoverLetterSchema.parse(letter));
  refresh(id);
  return saved;
}

export async function saveWhyAction(jobId: string, why: string) {
  const session = await requireSession();
  const id = JobId.parse(jobId);
  await saveWhy(session.user.id, id, z.string().max(1200).parse(why));
  refresh(id);
}

export async function saveInterviewNoteAction(jobId: string, questionId: string, note: string) {
  const session = await requireSession();
  const id = JobId.parse(jobId);
  await saveInterviewNote(session.user.id, id, questionId, note);
}
