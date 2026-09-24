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
