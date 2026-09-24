export const ONBOARDING_STEPS = ["start", "upload", "review", "basics", "experience", "skills", "goals", "done"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Steps shown in the progress bar. Upload and review only appear on the upload path. */
export const PROGRESS_STEPS: Array<{ id: OnboardingStep; label: string }> = [
  { id: "basics", label: "About you" },
  { id: "experience", label: "What you've done" },
  { id: "skills", label: "Skills" },
  { id: "goals", label: "What you want" },
];
