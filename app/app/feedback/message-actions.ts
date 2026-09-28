"use server";

import { requireSession } from "@/lib/auth";
import { FeedbackMessage, InboxLimitError, saveFeedback } from "@/lib/inbox/service";

/** The always-visible "Send feedback" button. Stored for the owner to read; nothing is emailed. */
export async function sendFeedbackMessageAction(input: { message: string; page?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const parsed = FeedbackMessage.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Write a few words first." };
  try {
    await saveFeedback({ id: session.user.id, email: session.user.email }, parsed.data);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof InboxLimitError ? error.message : "We couldn't save that. Try again in a minute." };
  }
}
