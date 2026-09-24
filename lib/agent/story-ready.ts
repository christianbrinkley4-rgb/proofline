/**
 * Enough confirmed evidence for a fit score and a resume to mean something.
 * Kept free of server imports so onboarding (a client component) can use it too.
 */
export function storyReady(input: { confirmedFacts: number; experiences: number }): boolean {
  return input.confirmedFacts >= 3 || (input.experiences >= 1 && input.confirmedFacts >= 1);
}
