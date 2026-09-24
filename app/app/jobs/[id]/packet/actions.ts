"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { CoverLetterSchema, type CoverLetter } from "@/lib/packet/cover-letter";
import { deleteAnswer, draftAnswer, draftCoverLetter, saveAnswer, saveCoverLetter, saveInterviewNote, saveWhy } from "@/lib/packet/service";

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

export async function draftAnswerAction(jobId: string, question: string, wordLimit: number | null) {
  const session = await requireSession();
  const id = JobId.parse(jobId);
  try {
    const answer = await draftAnswer(session.user.id, id, question, wordLimit);
    refresh(id);
    return { ok: true as const, answer };
  } catch (error) {
    return { ok: false as const, error: error instanceof z.ZodError ? error.issues[0]?.message ?? "Check the question." : "Couldn't draft that. Please try again." };
  }
}

export async function saveAnswerAction(jobId: string, answerId: string, text: string) {
  const session = await requireSession();
  const id = JobId.parse(jobId);
  await saveAnswer(session.user.id, id, z.uuid().parse(answerId), text);
  refresh(id);
}

export async function deleteAnswerAction(jobId: string, answerId: string) {
  const session = await requireSession();
  const id = JobId.parse(jobId);
  await deleteAnswer(session.user.id, id, z.uuid().parse(answerId));
  refresh(id);
}

export async function saveInterviewNoteAction(jobId: string, questionId: string, note: string) {
  const session = await requireSession();
  const id = JobId.parse(jobId);
  await saveInterviewNote(session.user.id, id, questionId, note);
}
