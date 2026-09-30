/**
 * The people who run the beta (OWNER_EMAILS, comma-separated). Only they see
 * /app/owner: reset links, feedback, contact messages, and system checks.
 */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function isOwner(email: string | null | undefined): boolean {
  return Boolean(email) && ownerEmails().includes(email!.trim().toLowerCase());
}
