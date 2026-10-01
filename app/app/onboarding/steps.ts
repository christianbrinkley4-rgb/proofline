/**
 * Three screens to a first resume: (1) about you, (2) your experience with
 * recommended lines, (3) paste a job. Then the job's resume page.
 *
 * "projects", "skills", and "logistics" still open on their own (a must-have
 * warning links to "logistics" with a way back), but the first-run path skips them.
 */
export const ONBOARDING_STEPS = ["education", "experience", "projects", "skills", "logistics", "job", "done"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The screens a new account walks through, in order. */
export const FIRST_RUN: readonly OnboardingStep[] = ["education", "experience", "job"];

export const PROGRESS_STEPS: Array<{ id: "education" | "experience" | "job"; label: string }> = [
  { id: "education", label: "About you" },
  { id: "experience", label: "Your experience" },
  { id: "job", label: "A job you want" },
];
