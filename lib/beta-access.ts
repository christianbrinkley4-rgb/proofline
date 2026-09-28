/**
 * The private-beta allowlist. Only addresses in BETA_EMAILS (comma-separated,
 * any case) can create an account. With BETA_EMAILS unset, nobody can sign up,
 * which is the safe default for a closed beta. Existing accounts can always sign in.
 */

export const PRIVATE_BETA_CODE = "PRIVATE_BETA";
export const PRIVATE_BETA_MESSAGE = "Proofline is in private beta. Sign-up is open to invited testers only.";

export function betaEmails(raw = process.env.BETA_EMAILS): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,;\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.includes("@")),
  );
}

export function canSignUp(email: unknown, env: { BETA_EMAILS?: string; NODE_ENV?: string } = process.env): boolean {
  if (typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@")) return false;
  if (betaEmails(env.BETA_EMAILS).has(clean)) return true;
  // The local dev helpers (/api/dev/login) create example.com accounts; they return 404 outside development.
  return env.NODE_ENV === "development" && clean.endsWith("@example.com");
}
