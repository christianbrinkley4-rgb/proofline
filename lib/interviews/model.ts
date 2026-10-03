import { z } from "zod";
import type { FitReport } from "@/lib/fit/engine";

export const OutcomeSchema = z.enum(["interview", "rejection", "no_response", "withdrawn"]);
export type Outcome = z.infer<typeof OutcomeSchema>;
export const OUTCOME_LABEL: Record<Outcome, string> = { interview: "Interview", rejection: "Rejection", no_response: "No response", withdrawn: "Withdrawn" };
export const ProbabilitySchema = z.number().int().min(0).max(100);
export type Prediction = { id: string; applicationId: string; gate: string; fingerprint: string; probability: number; reasoning: string; version: string; at: string };
export type ApplicationOutcome = { applicationId: string; outcome: Outcome; predictionId: string | null; probability: number | null; submittedAt: string; at: string };

/** An explicit prior, not a fit score relabeled as observed success or a promise. */
export function interviewPrior(fit: Pick<FitReport, "score" | "strengths" | "gaps" | "gates">) {
  const blocked = fit.gates.length > 0;
  const probability = blocked ? 0 : Math.max(5, Math.min(60, Math.round(5 + fit.score * 0.55)));
  const clean = (text: string) => text.replace(/[\r\n]+/g, " ").replace(/\u2014/g, ";").slice(0, 180);
  return { probability, reasoning: `For: ${clean(fit.strengths[0] || "the document passed review")}; against: ${clean(fit.gaps[0] || "employer response and applicant competition are unknown")}.`, version: "interview-fit-prior.v1" };
}

export function bucketIndex(probability: number) {
  ProbabilitySchema.parse(probability);
  return Math.max(0, Math.ceil(probability / 20) - 1);
}
export type CalibrationBucket = { label: string; count: number; resolved: number; pending: number; withdrawn: number; interviews: number; predicted: number | null; actual: number | null };
export type CalibrationRow = { applicationId: string; probability: number; outcome: Outcome | null };

/** One pre-submission prediction per application. Pending and withdrawn never become rejections. */
export function calibration(rows: CalibrationRow[]): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = ["0-20%", "21-40%", "41-60%", "61-80%", "81-100%"].map((label) => ({ label, count: 0, resolved: 0, pending: 0, withdrawn: 0, interviews: 0, predicted: null, actual: null }));
  const sums = Array(5).fill(0) as number[];
  const unique = new Map(rows.map((row) => [row.applicationId, row]));
  for (const row of unique.values()) {
    const index = bucketIndex(row.probability);
    const bucket = buckets[index];
    bucket.count++;
    if (!row.outcome) { bucket.pending++; continue; }
    if (row.outcome === "withdrawn") { bucket.withdrawn++; continue; }
    bucket.resolved++;
    sums[index] += row.probability;
    if (row.outcome === "interview") bucket.interviews++;
  }
  for (const [i, bucket] of buckets.entries()) {
    if (bucket.resolved) { bucket.predicted = sums[i] / bucket.resolved; bucket.actual = 100 * bucket.interviews / bucket.resolved; }
  }
  return buckets;
}

/** Later gates must never rewrite the prediction that existed when the application went in. */
export function submissionPrediction(predictions: Prediction[], applicationId: string, submittedAt: string): Prediction | null {
  return predictions.filter((p) => p.applicationId === applicationId && p.at <= submittedAt && ["resume", "letter", "outreach"].includes(p.gate)).sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}
