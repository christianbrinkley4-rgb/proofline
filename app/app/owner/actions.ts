"use server";

import { requireSession } from "@/lib/auth";
import { emailConfigured, sendEmail } from "@/lib/email";
import { isOwner } from "@/lib/owner";
import { checkAiHealth, type AiHealth } from "@/lib/review/health";

async function requireOwner() {
  const session = await requireSession();
  if (!isOwner(session.user.email)) throw new Error("Not found.");
  return session;
}

export async function runAiCheckAction(): Promise<AiHealth> {
  await requireOwner();
  return checkAiHealth();
}

export async function sendTestEmailAction(): Promise<{ ok: boolean; message: string }> {
  const session = await requireOwner();
  if (!emailConfigured()) return { ok: false, message: "Email isn't set up. Add RESEND_API_KEY and EMAIL_FROM in Vercel, then redeploy." };
  const result = await sendEmail({
    to: session.user.email,
    subject: "Proofline test email",
    text: "This is a test from the Proofline owner page. Password-reset emails will arrive the same way.",
  });
  return result === "sent"
    ? { ok: true, message: `Sent to ${session.user.email}. Check your inbox and spam folder.` }
    : { ok: false, message: "Resend refused the email. The Vercel logs show why (search for [email])." };
}
