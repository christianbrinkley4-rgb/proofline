import type { ResumeDocument } from "@/lib/resume/document";

/**
 * A resume as plain text for review: exactly the words on the page, in page
 * order, one line per rendered line group. Bold is marked **like this** where the
 * renderer draws bold, so the linter can check it. Bullets start with "- ".
 *
 * Also returns which bullet (and so which facts) each line came from, so a
 * flagged quote can send the user straight to the fact behind it.
 */

export type ResumeLine = { text: string; kind: "name" | "contact" | "heading" | "entry" | "education" | "bullet" | "skills" | "detail"; bulletId?: string; factIds?: string[] };

export function resumeLines(doc: ResumeDocument): ResumeLine[] {
  const lines: ResumeLine[] = [{ text: doc.header.name, kind: "name" }];
  if (doc.header.contact.length) lines.push({ text: doc.header.contact.join(" | "), kind: "contact" });
  for (const section of doc.sections) {
    lines.push({ text: section.title.toUpperCase(), kind: "heading" });
    if (section.kind === "education") {
      for (const e of section.entries) {
        lines.push({ text: [`**${e.school}**`, e.gradLine].filter(Boolean).join(" | "), kind: "education" });
        if (e.degreeLine) lines.push({ text: [e.degreeLine, e.location].filter(Boolean).join(" | "), kind: "education" });
        for (const d of e.details) lines.push({ text: d, kind: "detail" });
      }
    } else if (section.kind === "entries") {
      for (const e of section.entries) {
        const lead = e.title || e.org;
        const rest = [e.title ? e.org : null, e.location, e.dates].filter(Boolean);
        lines.push({ text: [`**${lead}**`, ...rest].join(" | "), kind: "entry" });
        for (const b of e.bullets) lines.push({ text: `- ${b.text}`, kind: "bullet", bulletId: b.id, factIds: b.factIds });
      }
    } else {
      for (const l of section.lines) if (l.items.length) lines.push({ text: `${l.label}: ${l.items.join(", ")}`, kind: "skills" });
    }
  }
  return lines;
}

export function resumeToText(doc: ResumeDocument): string {
  return resumeLines(doc).map((l) => l.text).join("\n");
}
