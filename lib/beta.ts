import { redirect } from "next/navigation";

/**
 * The private beta ships one loop: facts, paste a job, knockouts and fit score,
 * one tailored resume behind the review gate, and the tracker. Everything else
 * (agent chat, the MCP connector, career plans, cover-letter packets, live job
 * search, the old profile tools) stays in the codebase but is hidden from testers.
 * Flip this to bring those surfaces back.
 */
export const PRIVATE_BETA = true;

/** Call at the top of a page that's out of scope for the beta. */
export function hiddenInBeta(to = "/app"): void {
  if (PRIVATE_BETA) redirect(to);
}
