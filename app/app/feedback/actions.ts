"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { deleteFeedback, FeedbackInput, submitFeedback } from "@/lib/feedback/service";

/** Feedback stays in the account; consent separately permits future cross-user review. */
export async function submitFeedbackAction(form: FormData) {
  const userId = (await requireSession()).user.id;
  const event = await submitFeedback(userId, FeedbackInput.parse({
    kind: form.get("kind"),
    subjectId: String(form.get("subjectId") ?? ""),
    rating: form.get("rating"),
    issue: form.get("issue") || null,
    comment: form.get("comment") ? String(form.get("comment")) : null,
    consentToImprove: ["on", "true", "1"].includes(String(form.get("consentToImprove") ?? "")),
  }));
  return { feedbackId: event.id };
}

export async function deleteFeedbackAction(form: FormData) {
  const userId = (await requireSession()).user.id;
  const feedbackId = z.uuid().parse(form.get("feedbackId"));
  await deleteFeedback(userId, feedbackId);
}