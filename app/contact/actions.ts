"use server";

import { z } from "zod";
import { ContactMessage, InboxLimitError, saveContact } from "@/lib/inbox/service";

export type ContactResult = { ok: true } | { ok: false; error: string };

/** The public contact form. Messages are stored for the owner to read; nothing is emailed. */
export async function sendContactAction(input: { name?: string; email: string; message: string; website?: string }): Promise<ContactResult> {
  // Bots fill every field, including this hidden one. Pretend it worked.
  if (input.website) return { ok: true };
  const parsed = ContactMessage.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    await saveContact(parsed.data);
    return { ok: true };
  } catch (error) {
    if (error instanceof InboxLimitError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the form." };
    return { ok: false, error: "We couldn't save your message. Try again in a minute." };
  }
}
