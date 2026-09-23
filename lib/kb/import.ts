import type { ParsedResume } from "@/lib/resume/parse/types";
import { addFact, listFacts } from "./facts";
import { createExperience, listExperiences, type ExperienceKind } from "./experiences";

export type ImportSummary = {
  experiences: number;
  facts: number;
  skipped: number;
};

function kindFor(section: ParsedResume["entries"][number]["section"], title: string | null): ExperienceKind {
  if (section === "experience") return title && /\bintern(ship)?\b/i.test(title) ? "internship" : "work";
  return section;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Turns a parsed resume into proposals: experiences plus one unconfirmed fact per
 * bullet, skill, and certification. Nothing here reaches a resume until the user
 * confirms it. Re-uploading the same resume doesn't create duplicates.
 */
export async function importParsedResume(userId: string, parsed: ParsedResume, fileName: string): Promise<ImportSummary> {
  const existingExperiences = await listExperiences(userId);
  const existingFacts = await listFacts(userId, { states: ["confirmed", "unconfirmed", "needs_review", "rejected"] });
  const seen = new Set(existingFacts.map((f) => `${f.experienceId ?? ""}|${norm(f.content)}`));
  const summary: ImportSummary = { experiences: 0, facts: 0, skipped: 0 };

  const propose = async (input: Parameters<typeof addFact>[1]) => {
    const key = `${input.experienceId ?? ""}|${norm(input.content)}`;
    if (seen.has(key)) {
      summary.skipped++;
      return;
    }
    seen.add(key);
    await addFact(userId, input);
    summary.facts++;
  };

  for (const entry of parsed.entries) {
    let experience = existingExperiences.find((e) => norm(e.org) === norm(entry.org) && norm(e.title) === norm(entry.title));
    if (!experience) {
      experience = await createExperience(userId, {
        kind: kindFor(entry.section, entry.title),
        org: entry.org,
        title: entry.title,
        location: entry.location,
        startDate: entry.startDate,
        endDate: entry.endDate,
        rawNotes: entry.bullets.join("\n"),
      });
      existingExperiences.push(experience);
      summary.experiences++;
    }
    for (const text of entry.bullets) {
      await propose({ category: "experience", content: text, experienceId: experience.id, source: "resume_parsed", sourceDetail: fileName });
    }
  }

  for (const edu of parsed.education) {
    for (const honor of edu.honors) {
      await propose({ category: "award", content: honor, source: "resume_parsed", sourceDetail: fileName });
    }
    if (edu.coursework.length) {
      await propose({
        category: "education",
        content: `Coursework: ${edu.coursework.join(", ")}`,
        data: { coursework: edu.coursework },
        source: "resume_parsed",
        sourceDetail: fileName,
      });
    }
  }

  for (const skill of parsed.skills) {
    await propose({ category: "skill", content: skill, source: "resume_parsed", sourceDetail: fileName });
  }
  for (const cert of parsed.certifications) {
    await propose({ category: "certification", content: cert, source: "resume_parsed", sourceDetail: fileName });
  }

  return summary;
}
