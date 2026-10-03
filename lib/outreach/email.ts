import { emailConfigured } from "@/lib/email";
import type { MessageDraft } from "./model";
export async function deliverMessage(input: MessageDraft & { to: string; replyTo: string; id: string }): Promise<{ status: "accepted"; providerId: string } | { status: "rejected" | "unconfirmed" }> {
  if (!emailConfigured()) throw new Error("Sending is not configured. Your reviewed draft is saved; no email was sent.");
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "content-type": "application/json", "Idempotency-Key": input.id }, body: JSON.stringify({ from: process.env.EMAIL_FROM!.trim(), to: [input.to], reply_to: input.replyTo, subject: input.subject, text: input.body }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) return { status: response.status >= 500 ? "unconfirmed" : "rejected" };
    const data = await response.json() as { id?: string };
    return data.id ? { status: "accepted", providerId: data.id } : { status: "unconfirmed" };
  } catch { return { status: "unconfirmed" }; }
}
