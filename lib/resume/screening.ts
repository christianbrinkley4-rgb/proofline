import { extractEvidenceSkills } from "@/lib/fit/skills";
import type { Requirements } from "@/lib/fit/requirements";
import type { ResumeDocument } from "./document";

export type RequirementEvidence = {
  label: string;
  status: "example" | "listed" | "profile" | "missing";
  evidence: string | null;
};

export type ScreeningReport = {
  coveredRequired: number;
  totalRequired: number;
  coveredPreferred: number;
  totalPreferred: number;
  visibleTerms: string[];
  notShown: string[];
  requiredEvidence: RequirementEvidence[];
};

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
 * Shows the actual source for each parsed requirement. A job title, school name,
 * or company name is not proof that a skill appears on the resume. A skill list
 * is visible, but a work example is more persuasive and receives its own state.
 */
export function screeningReport(
  doc: ResumeDocument,
  requirements: Requirements,
  confirmedProfileText: string[] = [],
): ScreeningReport {
  const bullets = doc.sections.flatMap((section) =>
    section.kind === "entries" ? section.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)) : [],
  );
  const listed = doc.sections.flatMap((section) =>
    section.kind === "skills" ? section.lines.flatMap((line) => line.items) : [],
  );
  const skillsOf = (text: string) => new Set(extractEvidenceSkills(text));
  const examples = bullets.map((text) => ({ text, skills: skillsOf(text) }));
  const skillLines = listed.map((text) => ({ text, skills: skillsOf(text) }));
  const profileLines = confirmedProfileText.map((text) => ({ text, skills: skillsOf(text) }));
  const evidenceFor = (group: string[]): RequirementEvidence => {
    const label = group.join(" or ");
    const matches = (skills: Set<string>) => group.some((term) => skills.has(term));
    const example = examples.find((item) => matches(item.skills));
    if (example) return { label, status: "example", evidence: example.text };
    const skill = skillLines.find((item) => matches(item.skills));
    if (skill) return { label, status: "listed", evidence: skill.text };
    const profile = profileLines.find((item) => matches(item.skills));
    if (profile) return { label, status: "profile", evidence: profile.text };
    return { label, status: "missing", evidence: null };
  };
  const required = uniqueGroups(requirements.requiredGroups).map(evidenceFor);
  const preferred = uniqueGroups(requirements.preferredGroups).map(evidenceFor);
  const visible = new Set([...examples, ...skillLines].flatMap((item) => [...item.skills]));
  return {
    coveredRequired: required.filter((item) => item.status === "example" || item.status === "listed").length,
    totalRequired: required.length,
    coveredPreferred: preferred.filter((item) => item.status === "example" || item.status === "listed").length,
    totalPreferred: preferred.length,
    visibleTerms: [...visible].filter((term) => requirements.mentioned.includes(term)),
    notShown: required.filter((item) => item.status === "profile" || item.status === "missing").map((item) => item.label),
    requiredEvidence: required,
  };
}
