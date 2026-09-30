import { formatMonth } from "./parse/dates";

/**
 * A resume as data. Tailoring produces one, the layout engine measures it,
 * and the PDF and DOCX renderers draw it. Stored with every resume version so a
 * resume that went out never changes afterwards.
 */

export type ResumeBulletItem = {
  id: string;
  text: string;
  factIds: string[];
};

export type ResumeEntry = {
  experienceId: string;
  org: string;
  title: string | null;
  location: string | null;
  dates: string;
  bullets: ResumeBulletItem[];
};

export type EducationEntry = {
  school: string;
  location: string | null;
  degreeLine: string;
  gradLine: string;
  details: string[];
};

export type EducationSource = {
  school: string;
  degree: string;
  major: string;
  minor?: string;
  /** YYYY-MM when known. */
  gradMonth: string | null;
  /** Stored graduation text, used when gradMonth is missing. */
  gradDate?: string;
  gpa: string;
  honors: string;
  coursework: string;
  extras?: string[];
};

function gpaLine(gpa: string): string | null {
  const match = gpa.match(/[0-4](?:\.\d{1,2})?/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value) || value < 3) return null;
  const digits = Math.round(value * 100) % 10 === 0 ? 1 : 2;
  return `GPA: ${value.toFixed(digits)}/4.0`;
}

function degreeLine(entry: EducationSource): string {
  const degree = entry.degree.trim();
  const major = entry.major.trim();
  const minor = entry.minor?.trim() ?? "";
  let line = degree;
  if (major && !degree.toLowerCase().includes(major.toLowerCase())) line = degree ? `${degree} in ${major}` : major;
  else if (!degree) line = major;
  if (minor) line = line ? `${line}, Minor in ${minor}` : `Minor in ${minor}`;
  return line;
}

function gradLine(entry: EducationSource, today: Date): string {
  if (entry.gradMonth) {
    const iso = entry.gradMonth.length === 4 ? `${entry.gradMonth}-05` : entry.gradMonth;
    const future = new Date(`${iso}-01`).getTime() > today.getTime();
    const label = formatMonth(entry.gradMonth);
    return label ? `${future ? "Expected " : ""}${label}` : "";
  }
  return entry.gradDate?.trim() ?? "";
}

/** Splits "A, B (x, y); C" into courses, leaving commas inside parentheses alone. */
export function splitCourses(body: string): string[] {
  const courses: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      courses.push(current.trim());
      current = "";
    } else current += ch;
  }
  courses.push(current.trim());
  return courses.filter(Boolean);
}

function courseworkLine(text: string, relevance?: (course: string) => number): string {
  let body = text.replace(/^(relevant\s+)?coursework\s*:\s*/i, "").trim();
  if (body && relevance) {
    // Same courses in the person's words; the ones this posting asks about come first.
    const courses = splitCourses(body);
    if (courses.length > 1) body = courses.map((course, i) => ({ course, i, score: relevance(course) })).sort((a, b) => b.score - a.score || a.i - b.i).map((c) => c.course).join(", ");
  }
  return body ? `Relevant coursework: ${body}` : "";
}

/** One resume block per school. GPA under 3.0 is left off. Honors and coursework stay in the person's words. */
export function buildEducationSection(
  entries: EducationSource[],
  opts?: { showCoursework?: (coursework: string) => boolean; courseRelevance?: (course: string) => number; today?: Date },
): EducationEntry[] {
  const today = opts?.today ?? new Date();
  const showCoursework = opts?.showCoursework ?? (() => true);
  return entries
    .filter((entry) => entry.school.trim())
    .map((entry) => {
      const gpa = gpaLine(entry.gpa);
      const honors = entry.honors.trim();
      const honorLine = honors ? (/^honors\b/i.test(honors) ? honors : `Honors: ${honors}`) : null;
      const details = [[gpa, honorLine].filter(Boolean).join("  |  ")].filter(Boolean);
      const coursework = courseworkLine(entry.coursework, opts?.courseRelevance);
      if (coursework && showCoursework(entry.coursework)) details.push(coursework);
      for (const extra of entry.extras ?? []) {
        const line = extra.trim();
        if (line) details.push(line);
      }
      return {
        school: entry.school.trim(),
        location: null,
        degreeLine: degreeLine(entry),
        gradLine: gradLine(entry, today),
        details,
      };
    });
}

export type ResumeSection =
  | { kind: "education"; title: string; entries: EducationEntry[] }
  | { kind: "entries"; title: string; entries: ResumeEntry[] }
  | { kind: "skills"; title: string; lines: Array<{ label: string; items: string[] }> };

export type ResumeDocument = {
  /** Sources for skills, awards, coursework, and certifications. */
  sourceFactIds?: string[];
  header: { name: string; contact: string[] };
  sections: ResumeSection[];
};

export type TemplateId = "classic" | "technical";
export type VariantId = "experience" | "skills" | "ats";

export const VARIANT_LABEL: Record<VariantId, string> = {
  experience: "Experience first",
  skills: "Skills first",
  ats: "Keyword match",
};

export const VARIANT_BLURB: Record<VariantId, string> = {
  experience: "Leads with your most relevant work. Best when your experience lines up with the role.",
  skills: "Picks bullets that prove the skills they list. Best when your titles don't match but your skills do.",
  ats: "Covers as many of the posting's terms as your confirmed facts allow. Best for large employers that screen by software.",
};

export function documentBullets(doc: ResumeDocument): ResumeBulletItem[] {
  return doc.sections.flatMap((s) => (s.kind === "entries" ? s.entries.flatMap((e) => e.bullets) : []));
}
