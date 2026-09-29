"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { occupationLabelForTask } from "@/lib/resume/onet-tasks";
import { answerSuggestion, bankStats, nextSuggestions, reviewSuggestion } from "@/lib/resume/suggestions/service";

const AnswerSchema = z.object({
  answer: z.enum(["yes", "no"]),
  reason: z.enum(["not_true", "true_but_weak", "wording"]).optional(),
  slotValue: z.string().max(40).optional(),
  editedText: z.string().max(300).optional(),
  confirmed: z.boolean().optional(),
  reviewId: z.uuid().optional(),
  reviewedText: z.string().max(300).optional(),
  xyz: z.object({ measure: z.string().max(80), method: z.string().max(120), result: z.string().max(100).optional() }).optional(),
});

export async function nextSuggestionsAction(experienceId: string, count = 5, mode: "bank" | "recall" = "bank") {
  const userId = (await requireSession()).user.id;
  const cards = await nextSuggestions(userId, z.uuid().parse(experienceId), z.number().int().min(1).max(10).parse(count), z.enum(["bank", "recall"]).parse(mode));
  return cards.map((card) => ({ ...card, occupation: occupationLabelForTask(card.taskId) }));
}

export async function answerSuggestionAction(id: string, input: z.infer<typeof AnswerSchema>) {
  const userId = (await requireSession()).user.id;
  const parsedId = z.uuid().safeParse(id);
  const parsedInput = AnswerSchema.safeParse(input);
  if (!parsedId.success || !parsedInput.success) return { ok: false as const, error: "That answer needs another look. Try again." };
  try {
    const result = await answerSuggestion(userId, parsedId.data, parsedInput.data);
    revalidatePath("/app", "layout");
    return { ok: true as const, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save your answer.";
    const expected = /number|Fill in|Finish the bullet|clear action|preview changed|wording review changed|Review the finished|Confirm that|out of date|expired|verify the bullet/i.test(message);
    return { ok: false as const, error: expected ? message : "Could not save your answer. Please try again." };
  }
}

export async function reviewSuggestionAction(id: string, input: { editedText: string; xyz: NonNullable<z.infer<typeof AnswerSchema>["xyz"]> }) {
  const userId = (await requireSession()).user.id;
  const parsedId = z.uuid().safeParse(id);
  const parsed = AnswerSchema.pick({ editedText: true, xyz: true }).required().safeParse(input);
  if (!parsedId.success || !parsed.success) return { ok: false as const, error: "Fill in the accomplishment, measure, and method before reviewing." };
  try { return await reviewSuggestion(userId, parsedId.data, parsed.data); }
  catch { return { ok: false as const, error: "The wording review could not finish. Check the answers and try again." }; }
}

export async function bankStatsAction() {
  return bankStats((await requireSession()).user.id);
}
