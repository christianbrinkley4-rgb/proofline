import type { TemplateId } from "./document";

/**
 * The two templates we ship. Both are single column, standard headings, one font
 * family, text-based: the rules in docs/research/RESUME-STANDARDS.md.
 *
 * Fonts are the PDF standard 14 (Times, Helvetica), metrically identical to
 * Times New Roman and Arial, which the DOCX uses. So the page we measure is the
 * page recruiters see.
 */
export type Template = {
  id: TemplateId;
  label: string;
  description: string;
  family: "times" | "helvetica";
  docxFont: string;
  headerAlign: "center" | "left";
  nameSize: number;
  bodySize: number;
  headingSize: number;
  /** Space around section headings, in points. */
  headingGap: number;
  lineHeight: number;
  margin: number;
  headingRule: boolean;
  headingUppercase: boolean;
};

export const TEMPLATES: Record<TemplateId, Template> = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Serif, centered name, ruled section headings. The Harvard career-services format. Best for accounting, finance, consulting, and business.",
    family: "times",
    docxFont: "Times New Roman",
    headerAlign: "center",
    nameSize: 18,
    bodySize: 11,
    headingSize: 11,
    headingGap: 8,
    lineHeight: 1.22,
    margin: 54,
    headingRule: true,
    headingUppercase: true,
  },
  technical: {
    id: "technical",
    label: "Technical",
    description: "Sans serif, left-aligned header with links, dense and clean. Based on Jake's Resume. Best for tech, data, and engineering.",
    family: "helvetica",
    docxFont: "Arial",
    headerAlign: "left",
    nameSize: 20,
    bodySize: 10.5,
    headingSize: 10.5,
    headingGap: 8,
    lineHeight: 1.22,
    margin: 50,
    headingRule: true,
    headingUppercase: true,
  },
};

/** Tightening steps tried before any bullet is cut, all inside the research limits (10.5pt body, 0.5in+ margins). */
export const TIGHTEN_STEPS: Array<Partial<Template>> = [
  {},
  { margin: 46, headingGap: 6 },
  { margin: 43, headingGap: 5, lineHeight: 1.16, bodySize: 10.5 },
];

export function defaultTemplateFor(roles: string[]): TemplateId {
  return roles.some((r) => ["software", "data", "product"].includes(r)) ? "technical" : "classic";
}
