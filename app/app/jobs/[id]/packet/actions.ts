"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logEvent } from "@/lib/agent/events";
import { requireSession } from "@/lib/auth";
import { confirmedFactTexts } from "@/lib/facts/base";
import { getJobForUser } from "@/lib/jobs/store";
import { CoverLetterSchema, type CoverLetter } from "@/lib/packet/cover-letter";
import { runLetterGate } from "@/lib/review/letter-gate";
import { practiceFeedback, type PracticeFeedback } from "@/lib/packet/practice";
import { deleteAnswer, draftAnswer, draftCoverLetter, packetView, saveAnswer, saveCoverLetter, saveInterviewNote, saveWhy } from "@/lib/packet/service";

const JobId = z.uuid();
export async function checkCoverLetterAction(jobId: string) {
  const session = await requireSession();
  const id = JobId.parse(jobId);
  const result = await runLetterGate(session.user.id, id);
  refresh(id); revalidatePath("/app/tracker"); return result;
}

function refresh(jobId: string) {
  revalidatePath(`/app/jobs/${jobId}/packet`);
  revalidatePath(`/app/jobs/${jobId}/kit`);
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

export type PracticeResult = { ok: true; feedback: PracticeFeedback } | { ok: false; error: string };

/** Saves a practiced answer and returns rules-based feedback on it, checked against the person's confirmed facts. */
export async function practiceFeedbackAction(jobId: string, questionId: string, answer: string): Promise<PracticeResult> {
  const session = await requireSession();
  const userId = session.user.id;
  const id = JobId.parse(jobId);
  const text = z.string().max(4000).safeParse(answer);
  if (!text.success) return { ok: false, error: "Keep a practice answer under 4,000 characters." };
  const [view, data, facts] = await Promise.all([packetView(userId, id), getJobForUser(userId, id), confirmedFactTexts(userId)]);
  const question = view?.prep.find((q) => q.id === questionId);
  if (!question || !data) return { ok: false, error: "This question isn't available anymore. Reload the page." };
  const feedback = practiceFeedback(text.data, question, facts, data.job.company);
  await saveInterviewNote(userId, id, questionId, text.data);
  await logEvent(userId, "practice_answered", { jobId: id, questionId, words: feedback.words, fixes: feedback.notes.filter((n) => n.tone === "fix").length });
  return { ok: true, feedback };
}
