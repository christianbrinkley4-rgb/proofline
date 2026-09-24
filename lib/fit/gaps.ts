import type { FitReport } from "./engine";

/**
 * Turns a fit report's gaps into questions a student can answer in a sentence.
 * An answer becomes a confirmed fact and new bullets; "not yet" is remembered so
 * the same skill isn't asked about on every job. Gaps a sentence can't close
 * (degree, years, eligibility) come back as plain advice instead.
 */

export type GapKind = "required" | "preferred" | "keyword";

export type Gap = {
  /** Stable key for the skill, e.g. "google-sheets". */
  id: string;
  /** What the posting asks for, e.g. "Excel or Google Sheets". */
  skill: string;
  kind: GapKind;
  question: string;
  why: string;
};

const WHY: Record<GapKind, string> = {
  required: "It's a listed requirement, worth up to 30 points of your fit.",
  preferred: "It's a nice-to-have. Showing it moves you ahead of people who only meet the basics.",
  keyword: "The posting uses this term. Having it on the page helps a recruiter or screening system find it.",
};

export function gapId(skill: string): string {
  return skill
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** "Journal entries" reads as "journal entries" mid-sentence; "SQL" and "QuickBooks" keep their capitals. */
export function inSentence(skill: string): string {
  return /^[A-Z][a-z]/.test(skill) && !/[A-Z]/.test(skill.slice(1).split(/\s/)[0]) ? skill[0].toLowerCase() + skill.slice(1) : skill;
}

function question(label: string, kind: GapKind): string {
  const skill = inSentence(label);
  if (kind === "required") return `They require ${skill}. Where have you used it?`;
  if (kind === "preferred") return `They'd like ${skill}. Have you used it anywhere?`;
  return `The posting mentions ${skill}. Have you worked with it?`;
}

/** Skill gaps worth asking about, required first, minus anything the student said they haven't done. */
export function skillGaps(fit: Pick<FitReport, "details">, declined: Iterable<string> = [], limit = 6): Gap[] {
  const skip = new Set([...declined].map(gapId));
  const seen = new Set<string>();
  const out: Gap[] = [];
  const add = (skill: string, kind: GapKind) => {
    const id = gapId(skill);
    // "Excel or Google Sheets" also covers a bare "Excel" keyword.
    const parts = skill.split(/\s+or\s+/i).map(gapId);
    if (!id || seen.has(id) || skip.has(id) || parts.some((p) => seen.has(p))) return;
    seen.add(id);
    for (const p of parts) seen.add(p);
    out.push({ id, skill, kind, question: question(skill, kind), why: WHY[kind] });
  };
  for (const s of fit.details.requiredSkills?.missing ?? []) add(s, "required");
  for (const s of fit.details.preferredSkills?.missing ?? []) add(s, "preferred");
  for (const s of (fit.details.keywords?.missing ?? []).slice(0, 3)) add(s, "keyword");
  return out.slice(0, limit);
}

/** Gaps a sentence can't close, as advice. */
export function hardGaps(fit: Pick<FitReport, "details" | "gates">): string[] {
  return [
    ...fit.gates.map((g) => g.reason),
    ...(fit.details.experience?.missing ?? []).map((m) => `${m}. Add dated work history if you have it; otherwise look at roles asking for less.`),
    ...(fit.details.education?.missing ?? []).map((m) => `They list: ${m}. Worth checking whether related coursework or equivalent experience is accepted.`),
  ];
}

/**
 * Which alternative the student actually named in their answer ("Excel or Google Sheets"
 * and they wrote about Sheets), so the skill fact says what they really used.
 */
export function skillFromAnswer(skill: string, answer: string): string {
  const options = skill.split(/\s+or\s+/i).map((s) => s.trim()).filter(Boolean);
  const text = answer.toLowerCase();
  return options.find((o) => text.includes(o.toLowerCase())) ?? options[0] ?? skill;
}
