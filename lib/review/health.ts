import { DEFAULT_REVIEW_MODEL, modelReview, reviewConfigured } from "./model";
import { reviewRecallWording } from "./recall";

/**
 * Sends the two AI calls testers depend on, with made-up data: a resume review
 * (downloads wait for it) and a fact-card wording review. Nothing about a real
 * person is sent, and no account's daily AI allowance is charged.
 */

export type AiCheck = { ok: boolean; detail: string };
export type AiHealth = { configured: boolean; model: string; review: AiCheck; wording: AiCheck; ms: number; at: string };

const HEALTH_USER = "ai-health-check";

const SAMPLE = {
  requirements: "Prepare reconciliations in Excel. Strong attention to detail.",
  resumeText: "EXPERIENCE\n**Front Desk Assistant** | Sample Clinic | Jan 2025 – Present\n- Reconciled 40 daily patient payments in Excel, catching 3 billing errors in one month",
  facts: ["Reconciled 40 daily patient payments in Excel", "Caught 3 billing errors in one month", "Front Desk Assistant at Sample Clinic since January 2025"],
};

export async function checkAiHealth(): Promise<AiHealth> {
  const model = process.env.PROOFLINE_REVIEW_MODEL?.trim() || DEFAULT_REVIEW_MODEL;
  const at = new Date().toISOString();
  if (!reviewConfigured()) {
    const missing = { ok: false, detail: "PROOFLINE_REVIEW_KEY is not set in Vercel." };
    return { configured: false, model, review: missing, wording: missing, ms: 0, at };
  }
  const started = Date.now();
  const [review, wording] = await Promise.all([
    modelReview(HEALTH_USER, SAMPLE, { chargeAccount: false }),
    reviewRecallWording(HEALTH_USER, { action: "Reconciled daily patient payments", measure: "40 payments a day", method: "an Excel tracker I built", result: "caught 3 billing errors in one month" }, "model", { chargeAccount: false }),
  ]);
  return {
    configured: true,
    model,
    review: review.status === "pass" || review.status === "fail" ? { ok: true, detail: `Answered (${review.status === "pass" ? "passed" : "flagged lines"} the sample resume).` } : { ok: false, detail: review.message },
    wording: wording.ok ? { ok: true, detail: `Answered: "${wording.text}"` } : { ok: false, detail: wording.error },
    ms: Date.now() - started,
    at,
  };
}
