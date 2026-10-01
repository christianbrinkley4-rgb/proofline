import { getPacket, draftCoverLetter, readLetter } from "@/lib/packet/service";
import { letterFailureReason, runLetterGate } from "@/lib/review/letter-gate";

/** Whether the cover letter for one role is finished and reviewed, and if not, what the person has to do. */
export type LetterOutcome = { ok: true } | { ok: false; reason: string; needs?: "why" };

/**
 * Drafts the cover letter from confirmed evidence and runs it through the same kind
 * of review as the resume. A letter the person already edited is theirs and is
 * reviewed as written, never redrafted. Their reason for wanting the job is the one
 * part Proofline does not write, so a letter without it stops here and says so.
 */
export async function packageLetter(userId: string, jobId: string): Promise<LetterOutcome> {
  try {
    const existing = readLetter(await getPacket(userId, jobId));
    if (existing?.generator !== "user") await draftCoverLetter(userId, jobId);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "The cover letter could not be drafted." };
  }
  const gate = await runLetterGate(userId, jobId);
  if (!gate) return { ok: false, reason: "The cover letter could not be read back for review." };
  if (gate.passed) return { ok: true };
  const needsWhy = gate.checks.some((c) => c.id === "placeholder" && !c.ok);
  return { ok: false, reason: letterFailureReason(gate), needs: needsWhy ? "why" : undefined };
}
