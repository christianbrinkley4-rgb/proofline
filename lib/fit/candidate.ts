import { listExperiences } from "@/lib/kb/experiences";
import { listFacts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { listBullets } from "@/lib/resume/bullets/service";
import type { CandidateProfile } from "./engine";

/** Everything the fit engine may use about a student: confirmed facts only, never proposals. */
export async function loadCandidate(userId: string): Promise<CandidateProfile> {
  const [profile, experiences, facts, bullets] = await Promise.all([
    getProfile(userId),
    listExperiences(userId),
    listFacts(userId, { states: ["confirmed"] }),
    listBullets(userId),
  ]);

  return {
    confirmedText: [...facts.map((f) => f.content), ...bullets.filter((b) => b.status === "active").map((b) => b.text)],
    experienceTitles: experiences.flatMap((e) => [e.title, e.org].filter((x): x is string => Boolean(x))),
    hasInternship: experiences.some((e) => e.kind === "internship"),
    major: profile?.major ?? null,
    minor: profile?.minor ?? null,
    degree: profile?.degree ?? null,
    gpa: profile?.gpa ?? null,
    gradDate: profile?.gradDate ?? null,
    targetLocations: profile?.targetLocations ?? [],
    workModes: profile?.workModes ?? [],
    needsSponsorship: profile?.workAuthorization === "needs_sponsorship",
    credentials: facts.filter((f) => f.category === "certification").map((f) => f.content),
  };
}
