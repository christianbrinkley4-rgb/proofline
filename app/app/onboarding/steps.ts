/**
 * Three guided steps: (1) tell us about yourself, split into short screens,
 * (2) paste your first job, (3) land on its fit score (the job page itself).
 */
export const ONBOARDING_STEPS = ["education", "experience", "projects", "skills", "logistics", "job", "done"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Screens inside step 1. Education and one experience are the minimum to score a job. */
export const ABOUT_SCREENS = ["education", "experience", "projects", "skills", "logistics"] as const satisfies readonly OnboardingStep[];

export const PROGRESS_STEPS: Array<{ id: "about" | "job" | "score"; label: string }> = [
  { id: "about", label: "Tell us about yourself" },
  { id: "job", label: "Paste your first job" },
  { id: "score", label: "See your fit" },
];
