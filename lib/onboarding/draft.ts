import type { ParsedResume } from "@/lib/resume/parse/types";

/**
 * A resume read into the onboarding form, for the person to check. Nothing here is
 * saved or treated as true until they review each screen and confirm it in their
 * own words, the same as typing it. Values the form can't hold exactly (a year
 * with no month, a fifth line) are left for them rather than guessed.
 */

export type RoleKind = "work" | "internship" | "leadership" | "volunteer" | "project" | "research";

export type RoleDraft = { key: string; kind: RoleKind; org: string; title: string; startDate: string; endDate: string; bullets: string[]; extraLines: number };

export type EducationDraft = {
  school: string;
  degree: string;
  major: string;
  gradDate: string;
  gpa: string;
  honors: string;
  coursework: string;
  details: string[];
};

export type ResumeDraft = {
  basics: {
    fullName: string;
    phone: string;
    city: string;
    region: string;
    /** From the resume header. Blank when the resume has no email. Never invented, and never the account email. */
    contactEmail: string;
    linkedinUrl: string;
    portfolioUrl: string;
    school: string;
    degree: string;
    major: string;
    gradDate: string;
    gpa: string;
  };
  /** Every school on the resume, with honors and coursework, for the person to confirm. */
  education: EducationDraft[];
  /** Labels for schools after the first. The form edits `education`. */
  otherEducation: string[];
  /** Education lines that are not a school, degree, date, GPA, honor, or course. Unticked until the person confirms each one. */
  educationDetails: string[];
  roles: RoleDraft[];
  skills: string[];
  licenses: string[];
};

/** LinkedIn on linkedinUrl, and the first other link on portfolioUrl. */
export function profileLinks(links: string[]): { linkedinUrl: string; portfolioUrl: string } {
  const cleaned = [...new Set(links.map((link) => link.trim()).filter(Boolean))];
  return {
    linkedinUrl: cleaned.find((link) => /linkedin\.com/i.test(link)) ?? "",
    portfolioUrl: cleaned.find((link) => !/linkedin\.com/i.test(link)) ?? "",
  };
}

/** Only lines the person ticked. An unticked line is not saved. */
export function confirmedEducationDetails(items: Array<{ text: string; confirmed: boolean }>): string[] {
  const kept: string[] = [];
  for (const item of items) {
    const text = item.text.replace(/\s+/g, " ").trim();
    if (!item.confirmed || text.length < 2) continue;
    if (!kept.some((line) => line.toLowerCase() === text.toLowerCase())) kept.push(text);
  }
  return kept;
}

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
      contactEmail: parsed.email?.trim() ?? "",
      ...profileLinks(parsed.links),
      school: education?.school ?? "",
      degree: education?.degree ?? "",
      major: education?.major ?? "",
      gradDate: month(education?.gradDate),
      gpa: education?.gpa != null ? String(education.gpa) : "",
    },
    otherEducation: moreEducation.map((e) => [e.degree && e.major ? `${e.degree} in ${e.major}` : e.degree ?? e.major, e.school].filter(Boolean).join(", ")),
    education: parsed.education.filter((entry) => entry.school.trim()).map((entry) => ({
      school: entry.school.trim(),
      degree: entry.degree ?? "",
      major: entry.major ?? "",
      gradDate: month(entry.gradDate),
      gpa: entry.gpa != null ? String(entry.gpa) : "",
      honors: entry.honors.join("; "),
      coursework: entry.coursework.join(", "),
      details: entry.details ?? [],
    })),
    educationDetails: [...new Set(parsed.education.flatMap((entry) => (entry.details ?? []).map((line) => line.trim()).filter((line) => line.length > 1)))].slice(0, 12),
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

const same = (a: string, b: string) => {
  const norm = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  return norm(a) === norm(b);
};

/**
 * Importing a resume into an account that already has facts: keep only the
 * schools and roles it doesn't have yet, so nothing is added twice. A school
 * matches on name plus degree or graduation month; a role on organization plus title.
 */
export function newToAccount(
  draft: ResumeDraft,
  existing: { schools: Array<{ school: string; degree: string; gradDate: string }>; roles: Array<{ org: string; title: string }> },
): ResumeDraft {
  const knownSchool = (entry: EducationDraft) =>
    existing.schools.some((s) => same(s.school, entry.school) && ((s.degree && same(s.degree, entry.degree)) || (s.gradDate && s.gradDate === entry.gradDate)));
  const knownRole = (role: RoleDraft) => existing.roles.some((r) => same(r.org, role.org) && (same(r.title, role.title) || !r.title || !role.title));
  return { ...draft, education: draft.education.filter((entry) => !knownSchool(entry)), roles: draft.roles.filter((role) => !knownRole(role)) };
}
