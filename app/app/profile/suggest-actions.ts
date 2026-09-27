"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { answerSuggestion, bankStats, nextSuggestions } from "@/lib/resume/suggestions/service";

const AnswerSchema = z.object({
  answer: z.enum(["yes", "no"]),
  reason: z.enum(["not_true", "true_but_weak", "wording"]).optional(),
  slotValue: z.string().max(40).optional(),
  editedText: z.string().max(300).optional(),
});

export async function nextSuggestionsAction(experienceId: string, count = 5) {
  const userId = (await requireSession()).user.id;
  return nextSuggestions(userId, z.uuid().parse(experienceId), count);
}

export async function answerSuggestionAction(id: string, input: z.infer<typeof AnswerSchema>) {
  const userId = (await requireSession()).user.id;
  const result = await answerSuggestion(userId, z.uuid().parse(id), AnswerSchema.parse(input));
  revalidatePath("/app", "layout");
  return result;
}

export async function bankStatsAction() {
  return bankStats((await requireSession()).user.id);
}
