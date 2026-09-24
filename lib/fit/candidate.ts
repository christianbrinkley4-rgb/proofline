import { listExperiences } from "@/lib/kb/experiences";
import { listFacts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { listBullets } from "@/lib/resume/bullets/service";
import type { CandidateProfile } from "./engine";
import { verifyBullet } from "@/lib/resume/verify";

/** Lower bound from dated work. Overlapping jobs count once. */
export function documentedWorkYears(experiences: Array<{ kind: string; startDate: string | null; endDate: string | null }>, now = new Date()): number {
  const currentMonth = now.getFullYear() * 12 + now.getMonth() + 1;
  const months = new Set<number>();
  for (const experience of experiences) {
    if (experience.kind !== "work" && experience.kind !== "internship") continue;
    if (!experience.startDate || !/^\d{4}-\d{2}$/.test(experience.startDate)) continue;
    const [year, month] = experience.startDate.split("-").map(Number);
    const start = year * 12 + month - 1;
    const [endYear, endMonth] = experience.endDate?.split("-").map(Number) ?? [];
    const end = endYear && endMonth ? endYear * 12 + endMonth : currentMonth;
    for (let m = start; m < Math.min(end, currentMonth); m++) months.add(m);
  }
  return Math.round((months.size / 12) * 10) / 10;
}

/** Everything the fit engine may use about a student: confirmed facts only, never proposals. */
export async function loadCandidate(userId: string): Promise<CandidateProfile> {
  const [profile, experiences, facts, bullets] = await Promise.all([
    getProfile(userId),
    listExperiences(userId),
    listFacts(userId, { states: ["confirmed"] }),
    listBullets(userId),
  ]);

  const confirmed = new Map(facts.map((fact) => [fact.id, fact.content]));
  const supportedBullets = bullets.filter((bullet) => bullet.status === "active" && bullet.factIds.length > 0 &&
    bullet.factIds.every((id) => confirmed.has(id)) &&
    verifyBullet(bullet.text, bullet.factIds.map((id) => confirmed.get(id)!)).ok);

  return {
    confirmedText: [...facts.map((f) => f.content), ...supportedBullets.map((b) => b.text)],
    experienceTitles: experiences.flatMap((e) => [e.title, e.org].filter((x): x is string => Boolean(x))),
    hasInternship: experiences.some((e) => e.kind === "internship"),
    documentedYearsExperience: documentedWorkYears(experiences),
    hasUndatedWork: experiences.some((e) => (e.kind === "work" || e.kind === "internship") && !e.startDate),
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
