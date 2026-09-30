/**
 * Outgoing email, used only for password-reset links. Optional: with RESEND_API_KEY
 * and EMAIL_FROM set, mail goes through Resend's HTTP API (no SDK). Without them,
 * callers fall back to storing the link for the owner (lib/inbox/service.ts).
 */

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmail(message: { to: string; subject: string; text: string }): Promise<"sent" | "not_configured" | "failed"> {
  if (!emailConfigured()) return "not_configured";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM!.trim(), to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return "sent";
    // Resend's error names the problem (unverified domain, bad key); it never echoes the key.
    console.error(`[email] Resend HTTP ${response.status}: ${(await response.text().catch(() => "")).slice(0, 300)}`);
    return "failed";
  } catch (error) {
    console.error("[email] Resend request failed:", error instanceof Error ? error.message : String(error));
    return "failed";
  }
}
