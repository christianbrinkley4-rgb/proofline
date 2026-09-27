import type { SuggestionCandidate } from "./suggest";

/**
 * Reviewable priors from career-center advice and self-reported interview posts.
 * These are writing cues, not estimates of hiring probability. See
 * docs/research/OUTCOME-EXAMPLES.md for each source and its evidence level.
 */
export function successSignalScore(item: SuggestionCandidate): number {
  const text = item.text;
  let score = 0;
  if (item.kind === "skill_angle") score += 2; // A visible connection to a target role.
  if (item.sourceFactIds.length) score += 2; // A real statement from the student.
  if (/\b(using|through|by|with)\b/i.test(text)) score += 0.5; // Method or tool.
  if (/\b(saved|reduced|increased|improved|resolved|prevented|earned|resulting in)\b/i.test(text)) score += 1;
  if (item.slot) score += 0.5; // Ask for a defensible measure when it exists.
  if (text.length > 220) score -= 1;
  return score;
}
