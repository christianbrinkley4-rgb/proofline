import type { BasicsInput, GoalsInput } from "@/app/app/onboarding/actions";
import type { OnboardingStep } from "@/app/app/onboarding/steps";

export type FactView = {
  id: string;
  content: string;
  category: string;
  state: "confirmed" | "unconfirmed" | "needs_review" | "rejected";
  source: string;
  /** For connector facts, the name of the connected AI. */
  sourceDetail?: string | null;
};

export type QuestionView = { id: string; prompt: string; kind: "yes_no" | "number" | "text" | "choice"; proposedValue: string | null };

export type ExperienceView = {
  id: string;
  kind: string;
  org: string;
  title: string | null;
  dates: string;
  facts: FactView[];
  questions: QuestionView[];
};

export type OnboardingData = {
  step: OnboardingStep;
  firstName: string;
  basics: BasicsInput;
  goals: GoalsInput;
  experiences: ExperienceView[];
  looseFacts: FactView[];
  skills: FactView[];
};
