export const ONBOARDING_STEPS = ["start", "upload", "review", "basics", "goals", "experience", "skills", "done"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Steps shown in the progress bar. Upload and review only appear on the upload path. */
export const PROGRESS_STEPS: Array<{ id: OnboardingStep; label: string }> = [
  { id: "basics", label: "About you" },
  { id: "goals", label: "What you want" },
  { id: "experience", label: "What you've done" },
  { id: "skills", label: "Skills" },
];
