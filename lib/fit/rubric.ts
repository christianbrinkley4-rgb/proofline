/**
 * Fit score rubric. A score is a transparent sum of six components that add up
 * to 100, then capped by any eligibility gate the candidate fails.
 *
 * Why gates: a 90 on skills is worthless if the posting needs a graduation date,
 * license, or work authorization the candidate doesn't have. Gates cap the score
 * and say why, instead of hiding the problem inside a component.
 */

export const FIT_COMPONENTS = [
  { key: "requiredSkills", label: "Required skills", max: 30 },
  { key: "experience", label: "Experience relevance", max: 25 },
  { key: "education", label: "Education and qualifications", max: 15 },
  { key: "preferredSkills", label: "Preferred skills", max: 15 },
  { key: "keywords", label: "Keyword and ATS overlap", max: 10 },
  { key: "location", label: "Location and work mode", max: 5 },
] as const;

export type FitComponentKey = (typeof FIT_COMPONENTS)[number]["key"];

export type FitPoints = Record<FitComponentKey, number>;

export type EligibilityGate = {
  /** Plain-language reason shown to the user, e.g. "Open to 2027 graduates only". */
  reason: string;
  /** Highest score this job can show while the gate fails. */
  cap: number;
};

/** Default cap for a failed eligibility gate. Low enough to sink below real options, high enough to stay visible. */
export const ELIGIBILITY_CAP = 40;

export type FitResult = {
  /** Sum of clamped component points, before gates. */
  raw: number;
  /** Final 1 to 100 score shown to the user. */
  score: number;
  /** The gate that set the cap, if any. */
  cappedBy: EligibilityGate | null;
};

export function computeFit(points: FitPoints, gates: readonly EligibilityGate[] = []): FitResult {
  const raw = FIT_COMPONENTS.reduce((sum, { key, max }) => {
    const value = Number.isFinite(points[key]) ? points[key] : 0;
    return sum + Math.min(Math.max(value, 0), max);
  }, 0);

  const cappedBy = gates.reduce<EligibilityGate | null>(
    (lowest, gate) => (lowest === null || gate.cap < lowest.cap ? gate : lowest),
    null,
  );

  const capped = cappedBy && cappedBy.cap < raw ? cappedBy.cap : raw;
  const score = Math.min(100, Math.max(1, Math.round(capped)));

  return { raw, score, cappedBy: cappedBy && cappedBy.cap < raw ? cappedBy : null };
}

export type FitBand = "strong" | "good" | "stretch" | "long-shot";

export function fitBand(score: number): FitBand {
  if (score >= 80) return "strong";
  if (score >= 65) return "good";
  if (score >= 50) return "stretch";
  return "long-shot";
}

export const FIT_BAND_LABEL: Record<FitBand, string> = {
  strong: "Strong fit",
  good: "Good fit",
  stretch: "Stretch",
  "long-shot": "Long shot",
};
