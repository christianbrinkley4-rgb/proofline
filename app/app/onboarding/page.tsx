import type { Metadata } from "next";
import { BetaOnboarding, type BetaOnboardingData } from "@/components/onboarding/beta-flow";
import { requireSession } from "@/lib/auth";
import { ensureFactBase, loadFactBase, scoringReady } from "@/lib/facts/base";
import { ensureProfile } from "@/lib/kb/profile";
import { ONBOARDING_STEPS, type OnboardingStep } from "./steps";

export const metadata: Metadata = { title: "Get started" };

export default async function OnboardingPage({ searchParams }: PageProps<"/app/onboarding">) {
  const { step: requested, back } = await searchParams;
  const session = await requireSession();
  const userId = session.user.id;
  const profile = await ensureProfile(userId, session.user.name);
  await ensureFactBase(userId);
  const [base, readiness] = await Promise.all([loadFactBase(userId), scoringReady(userId)]);

  const isStep = (value: unknown): value is OnboardingStep => typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);
  // Older accounts may have a step name from the previous flow; start them at the top.
  const step: OnboardingStep = isStep(requested) ? requested : isStep(profile.onboardingStep) ? profile.onboardingStep : "education";

  const data: BetaOnboardingData = {
    step,
    firstName: (profile.fullName || session.user.name).split(/\s+/)[0],
    basics: {
      fullName: profile.fullName ?? session.user.name ?? "",
      phone: profile.phone ?? "",
      city: profile.city ?? "",
      region: profile.region ?? "",
      contactEmail: profile.contactEmail ?? "",
      linkedinUrl: profile.linkedinUrl ?? "",
      portfolioUrl: profile.portfolioUrl ?? "",
      school: profile.school ?? "",
      degree: profile.degree ?? "",
      major: profile.major ?? "",
      gradDate: profile.gradDate && /^\d{4}-\d{2}$/.test(profile.gradDate) ? profile.gradDate : "",
      gpa: profile.gpa != null ? String(profile.gpa) : "",
    },
    education: (base.educationEntries ?? []).filter((entry) => entry.school).map((entry) => ({
      entryId: entry.id,
      school: entry.school,
      degree: entry.degree,
      major: entry.major,
      gradDate: entry.gradMonth && /^\d{4}-\d{2}$/.test(entry.gradMonth) ? entry.gradMonth : "",
      gpa: entry.gpa,
      honors: entry.honors,
      coursework: entry.coursework,
    })),
    roles: base.roles.map((r) => ({
      id: r.experience.id,
      kind: r.experience.kind,
      name: [r.experience.title, r.experience.org].filter(Boolean).join(", "),
      lines: r.bullets.length,
    })),
    skills: base.skill.map((f) => f.text),
    licenses: base.license.map((f) => f.text),
    logistics: {
      workAuthorization: profile.workAuthorization ?? "",
      targetLocations: profile.targetLocations,
      workModes: profile.workModes,
      openToRelocate: profile.openToRelocate == null ? "" : profile.openToRelocate ? "yes" : "no",
      availableFrom: profile.availableFrom ?? "",
    },
    hasEducation: readiness.hasEducation,
    returnTo: typeof back === "string" && back.startsWith("/app/") && !back.startsWith("//") ? back : null,
  };

  return <BetaOnboarding data={data} />;
}
