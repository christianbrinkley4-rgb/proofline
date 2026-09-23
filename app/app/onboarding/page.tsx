import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/flow";
import type { OnboardingData } from "@/components/onboarding/types";
import { requireSession } from "@/lib/auth";
import { listExperiences } from "@/lib/kb/experiences";
import { listFacts, type Fact } from "@/lib/kb/facts";
import { ensureProfile } from "@/lib/kb/profile";
import { listOpenQuestions } from "@/lib/kb/questions";
import { formatRange } from "@/lib/resume/parse/dates";
import { ONBOARDING_STEPS, type OnboardingStep } from "./steps";

export const metadata: Metadata = { title: "Set up your agent" };

const toView = (f: Fact) => ({ id: f.id, content: f.content, category: f.category, state: f.verificationState, source: f.source });

export default async function OnboardingPage({ searchParams }: PageProps<"/app/onboarding">) {
  const requested = (await searchParams).step;
  const session = await requireSession();
  const userId = session.user.id;
  const profile = await ensureProfile(userId, session.user.name);
  const [experiences, facts, questions] = await Promise.all([listExperiences(userId), listFacts(userId), listOpenQuestions(userId)]);

  const isStep = (value: unknown): value is OnboardingStep => typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);
  const step: OnboardingStep = isStep(requested) ? requested : isStep(profile.onboardingStep) ? profile.onboardingStep : "start";

  const data: OnboardingData = {
    step: profile.onboardingCompletedAt && step === "done" ? "done" : step,
    firstName: (profile.fullName || session.user.name).split(/\s+/)[0],
    basics: {
      fullName: profile.fullName ?? session.user.name ?? "",
      phone: profile.phone ?? "",
      city: profile.city ?? "",
      region: profile.region ?? "",
      linkedinUrl: profile.linkedinUrl ?? "",
      portfolioUrl: profile.portfolioUrl ?? "",
      school: profile.school ?? "",
      degree: profile.degree ?? "",
      major: profile.major ?? "",
      minor: profile.minor ?? "",
      gradDate: profile.gradDate ?? "",
      gpa: profile.gpa != null ? String(profile.gpa) : "",
    },
    goals: {
      targetRoles: profile.targetRoles,
      targetTerm: profile.targetTerm ?? "",
      targetLocations: profile.targetLocations,
      workModes: profile.workModes,
      industries: profile.industries,
      payFloor: profile.payFloor != null ? String(profile.payFloor) : "",
      workAuthorization: profile.workAuthorization ?? "",
      dealBreakers: profile.dealBreakers,
    },
    experiences: experiences.map((e) => ({
      id: e.id,
      kind: e.kind,
      org: e.org,
      title: e.title,
      dates: e.startDate || e.endDate ? formatRange(e.startDate, e.endDate) : "",
      facts: facts.filter((f) => f.experienceId === e.id).map(toView),
      questions: questions
        .filter((q) => q.experienceId === e.id)
        .map((q) => ({ id: q.id, prompt: q.prompt, kind: q.kind, proposedValue: q.proposedValue })),
    })),
    looseFacts: facts.filter((f) => !f.experienceId && !["skill", "tool"].includes(f.category)).map(toView),
    skills: facts.filter((f) => ["skill", "tool"].includes(f.category)).map(toView),
  };

  return <OnboardingFlow data={data} />;
}
