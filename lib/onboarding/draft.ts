import type { ParsedResume } from "@/lib/resume/parse/types";

/**
 * A resume read into the onboarding form, for the person to check. Nothing here is
 * saved or treated as true until they review each screen and confirm it in their
 * own words, the same as typing it. Values the form can't hold exactly (a year
 * with no month, a fifth line) are left for them rather than guessed.
 */

export type RoleKind = "work" | "internship" | "leadership" | "volunteer" | "project" | "research";

export type RoleDraft = { key: string; kind: RoleKind; org: string; title: string; startDate: string; endDate: string; bullets: string[]; extraLines: number };

export type ResumeDraft = {
  basics: { fullName: string; phone: string; city: string; region: string; school: string; degree: string; major: string; gradDate: string; gpa: string };
  /** Other schools or degrees on the resume, which the one-school form can't hold. */
  otherEducation: string[];
  roles: RoleDraft[];
  skills: string[];
  licenses: string[];
};

/** Most lines the onboarding form holds for one role. */
export const MAX_LINES = 4;

const month = (value: string | null | undefined) => (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : "");

function kindOf(section: ParsedResume["entries"][number]["section"], title: string | null, org: string): RoleKind {
  if (section === "leadership" || section === "volunteer" || section === "project" || section === "research") return section;
  if (title && /\bintern(ship)?\b/i.test(title)) return "internship";
  // Clubs often sit under Experience; they belong with clubs and leadership.
  return /\b(club|society|association|chapter|council|fraternity|sorority|student government)\b/i.test(org) ? "leadership" : "work";
}

export function draftFromResume(parsed: ParsedResume): ResumeDraft {
  const [education, ...moreEducation] = parsed.education;
  const [city = "", region = ""] = (parsed.location ?? "").split(/,\s*/);
  return {
    basics: {
      fullName: parsed.name?.trim() ?? "",
      phone: parsed.phone?.trim() ?? "",
      city: city.trim(),
      region: region.trim(),
      school: education?.school ?? "",
      degree: education?.degree ?? "",
      major: education?.major ?? "",
      gradDate: month(education?.gradDate),
      gpa: education?.gpa != null ? String(education.gpa) : "",
    },
    otherEducation: moreEducation.map((e) => [e.degree && e.major ? `${e.degree} in ${e.major}` : e.degree ?? e.major, e.school].filter(Boolean).join(", ")),
    roles: parsed.entries
      .filter((e) => e.org.trim() && e.bullets.length)
      .map((e, i) => ({
        key: `r${i}`,
        kind: kindOf(e.section, e.title, e.org),
        org: e.org.trim(),
        title: e.title?.trim() ?? "",
        startDate: month(e.startDate),
        endDate: month(e.endDate),
        bullets: e.bullets.slice(0, MAX_LINES).map((b) => b.trim().slice(0, 400)),
        extraLines: Math.max(0, e.bullets.length - MAX_LINES),
      })),
    skills: [...new Set(parsed.skills.map((s) => s.trim()).filter((s) => s && s.length <= 80))].slice(0, 40),
    licenses: [...new Set(parsed.certifications.map((s) => s.trim()).filter((s) => s && s.length <= 160))].slice(0, 20),
  };
}
