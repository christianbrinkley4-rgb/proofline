/**
 * Who can create an account during the beta. BETA_EMAILS is a comma-separated
 * list of addresses (any case), or "*" to open sign-up to any email. With it
 * unset, nobody can sign up, which is the safe default for a closed beta.
 * Existing accounts can always sign in.
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

/** True when BETA_EMAILS holds "*": anyone with an email can sign up. */
export function signupOpen(raw = process.env.BETA_EMAILS): boolean {
  return (raw ?? "").split(/[,;\s]+/).some((entry) => entry.trim() === "*");
}

export function canSignUp(email: unknown, env: { BETA_EMAILS?: string; NODE_ENV?: string } = process.env): boolean {
  if (typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return false;
  if (signupOpen(env.BETA_EMAILS)) return true;
  if (betaEmails(env.BETA_EMAILS).has(clean)) return true;
  // The local dev helpers (/api/dev/login) create example.com accounts; they return 404 outside development.
  return env.NODE_ENV === "development" && clean.endsWith("@example.com");
}
