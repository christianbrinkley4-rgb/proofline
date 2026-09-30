import { z } from "zod";
import { scoringReady } from "@/lib/facts/base";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { checkKnockouts, knockoutCandidate, type KnockoutStatus } from "@/lib/fit/knockouts";
import { parseRequirements } from "@/lib/fit/requirements";
import { FIT_BAND_LABEL, FIT_COMPONENTS, fitBand } from "@/lib/fit/rubric";
import { extractKeywords } from "@/lib/jobs/keywords";
import { detectLevel, detectMode } from "@/lib/jobs/text";
import { getProfile } from "@/lib/kb/profile";

/**
 * The fit score the extension shows on a job site, computed the same way as a
 * saved job (lib/fit/engine.ts and lib/fit/knockouts.ts) but never stored: the
 * posting is read, scored against the person's confirmed facts, and dropped.
 */

export const ScoreRequestSchema = z.object({
  title: z.string().trim().min(2, "Couldn't find the job title.").max(200),
  company: z.string().trim().max(160).optional().default(""),
  location: z.string().trim().max(160).optional().default(""),
  description: z.string().trim().min(200, "Couldn't find the full description.").max(40_000),
});
export type ScoreRequest = z.input<typeof ScoreRequestSchema>;

export type ExtensionScore = {
  score: number;
  band: string;
  /** False until the person has confirmed their education and one role, so the score has little evidence behind it. */
  ready: boolean;
  /** Only the checks that failed or couldn't run; passed ones are left out. */
  knockouts: Array<{ label: string; status: Exclude<KnockoutStatus, "ok">; reason: string }>;
  components: Array<{ label: string; points: number; max: number; math: string }>;
  matchedSkills: string[];
  missingSkills: string[];
};

const unique = (items: string[]) => [...new Set(items)];

export async function scorePosting(userId: string, input: ScoreRequest): Promise<ExtensionScore> {
  const posting = ScoreRequestSchema.parse(input);
  const location = posting.location || null;
  const requirements = parseRequirements(posting.description);
  const mode = detectMode(location, posting.title, posting.description.slice(0, 2000));
  const [candidate, profile, readiness] = await Promise.all([loadCandidate(userId), getProfile(userId), scoringReady(userId)]);

  const fit = scoreFit(
    { title: posting.title, location, mode, level: detectLevel(posting.title, posting.description.slice(0, 600)), requirements, keywords: extractKeywords(posting.description) },
    candidate,
  );
  const knockouts = checkKnockouts({ title: posting.title, location, mode, description: posting.description, requirements }, knockoutCandidate(profile));

  return {
    score: fit.score,
    band: FIT_BAND_LABEL[fitBand(fit.score)],
    ready: readiness.ready,
    // Knockouts first, worst first. "Couldn't check" never blocks, but the person should see it.
    knockouts: knockouts
      .filter((k) => k.status !== "ok")
      .sort((a, b) => (a.status === b.status ? 0 : a.status === "knockout" ? -1 : 1))
      .map((k) => ({ label: k.label, status: k.status as Exclude<KnockoutStatus, "ok">, reason: k.reason })),
    components: FIT_COMPONENTS.map(({ key, label, max }) => ({ label, points: fit.points[key], max, math: fit.details[key].math ?? `${fit.points[key]} of ${max}` })),
    matchedSkills: unique([...fit.details.requiredSkills.matched, ...fit.details.preferredSkills.matched]).slice(0, 8),
    missingSkills: unique([...fit.details.requiredSkills.missing, ...fit.details.preferredSkills.missing]).slice(0, 8),
  };
}
