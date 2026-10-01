import { EM_DASH } from "@/lib/voice/rules";
import { extractKeywords, matchKeywords } from "@/lib/jobs/keywords";
import { claimNumbers, lintResume, type LintCheck, type LintCheckId } from "@/lib/review/linter";
import type { ParsedResume } from "@/lib/resume/parse/types";

/**
 * The free public check: "Can you defend every line?" It reads a resume someone
 * pasted or uploaded, finds every claim a recruiter could ask them to back up, and
 * runs the content checks that don't need confirmed facts. Rules only: no model,
 * no storage. It can't know what's true; it shows what will be questioned.
 */

/** Checks that judge the words. Layout checks are left out: we rebuilt the text, so they'd judge our formatting, not theirs. */
const PUBLIC_CHECKS: LintCheckId[] = [
  "bullets_start_with_verb",
  "bullets_have_numbers",
  "no_corporate_filler",
  "no_banned_content",
  "no_em_dashes",
  "contact_info_complete",
  "no_duplicate_words_in_skills",
  "contractions_consistent",
];

/** Words that promise a size or a result without giving one, and the question each invites. */
const VAGUE: Array<[RegExp, (word: string) => string]> = [
  [/\b(various|numerous|multiple|several|many|countless)\b/i, (w) => `"${w}": how many? Put the number in, or cut the word.`],
  [/\b(significantly|substantially|dramatically|greatly|considerably)\b/i, (w) => `"${w}": by how much? Put the number in, or cut the word.`],
  [/\b(successfully|effectively|efficiently)\b/i, (w) => `"${w}": what was the result? Say that instead.`],
];

const capitalized = (word: string) => word[0].toUpperCase() + word.slice(1).toLowerCase();

/** Check wording for someone without a Proofline account: there are no "facts" yet. */
const PUBLIC_DETAIL: Partial<Record<LintCheckId, (detail: string) => string>> = {
  bullets_have_numbers: (d) => d.replace(" to your fact, if you know it.", ", if you know it."),
  // Someone using the free check has no onboarding or Settings to go to.
  contact_info_complete: (d) => d.replace(" Add it under Contact details in My experience.", " Add it to the line under your name."),
};

/**
 * A posting term as the posting wrote it: "account payable" shows as "accounts payable",
 * "quickbooks" as "QuickBooks". Terms the posting implies but never spells out get a capital.
 */
export function displayTerm(term: string, posting: string): string {
  const pattern = term
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/y$/, "(?:y|ies)") + "(?:s|es)?")
    .join("[\\s-]+");
  const found = posting.match(new RegExp(`\\b${pattern}\\b`, "i"))?.[0];
  return found ? found.replace(/\s+/g, " ") : term[0].toUpperCase() + term.slice(1);
}

export type Claim = { line: string; numbers: string[]; question: string };
export type Vague = { line: string; word: string; question: string };

export type DefendReport = {
  name: string | null;
  roles: number;
  bullets: number;
  /** Lines with a number: the first things an interviewer asks about. */
  claims: Claim[];
  /** Lines with a word that promises scale without a measure. */
  vague: Vague[];
  checks: LintCheck[];
  passed: number;
  keywords: { matched: string[]; missing: string[] } | null;
};

/** One question per line, keyed to the kind of number it leads with. */
export function followUp(numbers: string[]): string {
  const first = numbers[0] ?? "";
  if (/%/.test(first)) return "What was it before, what was it after, and over how long?";
  if (/^\$/.test(first)) return "Where does that dollar figure come from, and who could confirm it?";
  if (/x$/i.test(first)) return "Compared with what starting point?";
  return "How did you count that, and over what period?";
}

/** The parsed resume as the plain text the linter reads: uppercase headings, "- " bullets. */
export function lintText(parsed: ParsedResume): string {
  const lines: string[] = [parsed.name?.trim() || "Your name"];
  lines.push([parsed.location, parsed.email, parsed.phone, ...parsed.links].filter(Boolean).join(" | "));
  if (parsed.education.length) {
    lines.push("EDUCATION");
    for (const e of parsed.education) lines.push([e.school, [e.degree, e.major].filter(Boolean).join(", "), e.gradDate].filter(Boolean).join(" | "));
  }
  if (parsed.entries.length) {
    lines.push("EXPERIENCE");
    for (const entry of parsed.entries) {
      lines.push([entry.title, entry.org, entry.location].filter(Boolean).join(" | "));
      for (const bullet of entry.bullets) lines.push(`- ${bullet.trim()}`);
    }
  }
  if (parsed.skills.length) lines.push("SKILLS", `Skills: ${parsed.skills.join(", ")}`);
  return lines.join("\n");
}

/**
 * `rawText` is the resume as pasted or extracted. The checks read a rebuilt copy,
 * which loses punctuation between fields, so em dashes are looked for in the original.
 */
export function defendReport(parsed: ParsedResume, jobDescription = "", rawText = ""): DefendReport {
  const bullets = parsed.entries.flatMap((e) => e.bullets.map((b) => b.trim()).filter(Boolean));
  const claims: Claim[] = [];
  const vague: Vague[] = [];
  for (const line of bullets) {
    const numbers = claimNumbers(line).map((n) => n.token);
    if (numbers.length) claims.push({ line, numbers, question: followUp(numbers) });
    for (const [pattern, ask] of VAGUE) {
      const word = line.match(pattern)?.[0];
      if (word) {
        vague.push({ line, word, question: ask(capitalized(word)) });
        break;
      }
    }
  }

  const hasJob = jobDescription.trim().length >= 80;
  const text = lintText(parsed);
  const checks = lintResume({ resumeText: text, jobDescription: "", userFacts: [] })
    .filter((c) => PUBLIC_CHECKS.includes(c.id))
    .sort((a, b) => PUBLIC_CHECKS.indexOf(a.id) - PUBLIC_CHECKS.indexOf(b.id))
    .map((c) => {
      if (c.id === "no_em_dashes" && rawText) {
        const dashLines = rawText.split("\n").map((l) => l.trim()).filter((l) => l.includes(EM_DASH));
        if (dashLines.length) return { ...c, passed: false, evidence_quote: dashLines[0], failures: dashLines, detail: `${dashLines.length === 1 ? "A line uses" : `${dashLines.length} lines use`} an em dash. Use a comma or a period instead.` };
      }
      const reword = PUBLIC_DETAIL[c.id];
      return reword ? { ...c, detail: reword(c.detail) } : c;
    });
  const keywords = hasJob ? extractKeywords(jobDescription) : [];

  return {
    name: parsed.name,
    roles: parsed.entries.length,
    bullets: bullets.length,
    claims,
    vague,
    checks,
    passed: checks.filter((c) => c.passed).length,
    keywords: keywords.length ? tidyKeywords(matchKeywords(keywords, text), jobDescription) : null,
  };
}

function tidyKeywords(found: { matched: string[]; missing: string[] }, posting: string) {
  return { matched: found.matched.map((k) => displayTerm(k, posting)), missing: found.missing.map((k) => displayTerm(k, posting)) };
}
