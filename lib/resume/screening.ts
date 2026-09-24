import { extractSkills } from "@/lib/fit/skills";
import type { Requirements } from "@/lib/fit/requirements";
import type { ResumeDocument } from "./document";

export type ScreeningReport = {
  coveredRequired: number;
  totalRequired: number;
  coveredPreferred: number;
  totalPreferred: number;
  visibleTerms: string[];
  notShown: string[];
};

function documentText(doc: ResumeDocument): string {
  const lines = [doc.header.name, ...doc.header.contact];
  for (const section of doc.sections) {
    lines.push(section.title);
    if (section.kind === "education") {
      for (const entry of section.entries) lines.push(entry.school, entry.degreeLine, entry.gradLine, ...entry.details);
    } else if (section.kind === "entries") {
      for (const entry of section.entries) lines.push(entry.org, entry.title ?? "", entry.dates, ...entry.bullets.map((bullet) => bullet.text));
    } else {
      for (const line of section.lines) lines.push(line.label, ...line.items);
    }
  }
  return lines.join("\n");
}
function uniqueGroups(groups: string[][]): string[][] {
  const seen = new Set<string>();
  return groups.filter((group) => {
    const key = [...group].sort().join("|");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Reports which parsed job concepts are actually visible in this resume.
 * This is an explainable overlap check, never a prediction of an ATS decision.
 */
export function screeningReport(doc: ResumeDocument, requirements: Requirements): ScreeningReport {
  const visible = new Set(extractSkills(documentText(doc)));
  const required = uniqueGroups(requirements.requiredGroups);
  const preferred = uniqueGroups(requirements.preferredGroups);
  const covered = (group: string[]) => group.some((term) => visible.has(term));
  const notShown = required.filter((group) => !covered(group)).map((group) => group.join(" or "));
  return {
    coveredRequired: required.length - notShown.length,
    totalRequired: required.length,
    coveredPreferred: preferred.filter(covered).length,
    totalPreferred: preferred.length,
    visibleTerms: [...visible].filter((term) => requirements.mentioned.includes(term)),
    notShown,
  };
}
