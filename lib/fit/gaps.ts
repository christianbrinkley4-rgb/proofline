import { extractSkills, skillCategory } from "./skills";
import type { FitReport } from "./engine";

/**
 * Turns a fit report's gaps into questions a student can answer in a sentence.
 * An answer becomes a confirmed fact and new bullets; "not yet" is remembered so
 * the same skill isn't asked about on every job. Gaps a sentence can't close
 * (degree, years, eligibility) come back as plain advice instead.
 */

export type GapKind = "required" | "listed" | "preferred" | "keyword";

export type GapPrompt = { experienceId: string; org: string; taskId: string; task: string; source: "O*NET 31.0" | "Proofline" };

export type Gap = {
  /** Stable key for the skill, e.g. "google-sheets". */
  id: string;
  /** What the posting asks for, e.g. "Excel or Google Sheets". */
  skill: string;
  kind: GapKind;
  question: string;
  why: string;
  /** A plausible task to ask about, never a claim that the person did it. */
  suggestion?: GapPrompt;
};

const WHY: Record<GapKind, string> = {
  required: "The posting lists this as required. A real example helps you judge how well your experience fits.",
  listed: "This work appears in the role description, but the posting does not clearly call it a requirement. Include it only if you have a real example.",
  preferred: "The posting lists this as preferred. Include it only if you have a real example.",
  keyword: "The posting uses this term. Use the same wording only when it accurately describes your experience.",
};

export function gapId(skill: string): string {
  return skill
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** "Journal entries" reads as "journal entries" mid-sentence; "SQL" and "QuickBooks" keep their capitals. */
export function inSentence(skill: string): string {
  const first = skill.split(/\s+or\s+/i)[0];
  const genericNames = new Set(["Point-of-sale systems", "Electronic health records", "Scheduling software", "Tax software", "Data analysis", "Statistics", "Machine learning"]);
  if (["tool", "data", "software", "language"].includes(skillCategory(first) ?? "") && !genericNames.has(first)) return skill;
  return /^[A-Z][a-z]/.test(skill) && !/[A-Z]/.test(skill.slice(1).split(/\s/)[0]) ? skill[0].toLowerCase() + skill.slice(1) : skill;
}

function question(label: string, kind: GapKind): string {
  const skill = inSentence(label);
  const pronoun = /\b(?:entries|records|reports|statements|documents|invoices|payments|accounts|spreadsheets|tables|dashboards|systems)\b/i.test(skill) ? "them" : "it";
  if (kind === "required") return `They require ${skill}. Where have you used ${pronoun}?`;
  if (kind === "listed") return `The role mentions ${skill}. Have you used ${pronoun} anywhere?`;
  if (kind === "preferred") return `They'd like ${skill}. Have you used ${pronoun} anywhere?`;
  return `The posting mentions ${skill}. Have you worked with ${pronoun}?`;
}

/** Skill gaps worth asking about, required first, minus anything the student said they haven't done. */
export function skillGaps(fit: Pick<FitReport, "details"> & { requirementsInferred?: boolean }, declined: Iterable<string> = [], limit = 6): Gap[] {
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
  for (const s of fit.details.requiredSkills?.missing ?? []) add(s, fit.requirementsInferred ? "listed" : "required");
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
export function skillFromAnswer(skill: string, answer: string): string | null {
  const options = skill.split(/\s+or\s+/i).map((s) => s.trim()).filter(Boolean);
  // Treat each affirmative clause separately. "I never used Excel, but used
  // Google Sheets" should establish only Google Sheets.
  const clauses = answer.split(/[.!?;]|\bbut\b|\bhowever\b/i).map((part) => part.trim()).filter(Boolean);
  for (const clause of clauses) {
    if (/\b(?:never|not|without|didn'?t|haven'?t|wasn'?t|couldn'?t|don'?t|doesn'?t|can'?t|won'?t|no experience with)\b/i.test(clause)) continue;
    const named = options.find((option) => {
      const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(clause);
    });
    if (named) return named;
    // An action can establish a skill without using the exact label, e.g.
    // "reconciled vendor balances" establishes account reconciliation.
    // Posting keywords arrive lowercase ("account reconciliation"); skill names are capitalized.
    const detected = new Set(extractSkills(clause).map((name) => name.toLowerCase()));
    // Named software needs an explicit name. A transferable spreadsheet skill
    // is useful, but it does not prove the person used Excel itself.
    const namedTools = new Set(["Excel", "Google Sheets", "QuickBooks", "NetSuite", "SAP", "Oracle", "Workday", "Salesforce", "HubSpot", "PowerPoint", "Bloomberg", "Capital IQ", "FactSet", "Jira", "Figma", "Google Analytics", "Tableau", "Power BI", "Alteryx"]);
    for (const option of options) {
      const canonical = extractSkills(option).find((name) => name.toLowerCase() === option.toLowerCase());
      // Saved under the skill's own name, so it reads "Account reconciliation" on My facts.
      if (canonical && !namedTools.has(canonical) && detected.has(canonical.toLowerCase())) return canonical;
    }
  }
  return null;
}
