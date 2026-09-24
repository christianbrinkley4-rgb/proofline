import { extractSkills } from "@/lib/fit/skills";
import type { Requirements } from "@/lib/fit/requirements";

/**
 * The pieces of a person's confirmed story that can back a cover letter or an
 * interview answer, ranked for one posting. Only verified bullets and confirmed
 * facts qualify; each piece keeps the fact ids a reader can trace it to.
 */

export type EvidenceKind = "bullet" | "fact";

export type Evidence = {
  id: string;
  kind: EvidenceKind;
  text: string;
  experienceId: string | null;
  org: string | null;
  title: string | null;
  /** Confirmed facts this piece rests on (a fact cites itself). */
  factIds: string[];
  /** Posting skills this piece shows, required ones first. */
  covers: string[];
  relevance: number;
  /** Bullet quality 0 to 1; facts get a neutral value. */
  quality: number;
  /** 1 for current roles, lower the longer ago it ended. */
  recency: number;
};

export type EvidenceInput = Omit<Evidence, "covers" | "relevance">;

export type RequirementLabels = { required: Set<string>; preferred: Set<string>; mentioned: Set<string> };

export function requirementLabels(req: Requirements | null): RequirementLabels {
  return {
    required: new Set((req?.requiredGroups ?? []).flat()),
    preferred: new Set((req?.preferredGroups ?? []).flat()),
    mentioned: new Set(req?.mentioned ?? []),
  };
}

export function recencyOf(endDate: string | null, now = new Date()): number {
  if (!endDate) return 1;
  const end = new Date(`${endDate.length === 4 ? `${endDate}-06` : endDate}-01T00:00:00Z`);
  const years = (now.getTime() - end.getTime()) / (365 * 864e5);
  return Math.max(0.2, Math.min(1, 1 - years * 0.25));
}

/** Most useful first: what the posting asks for, then quality, then how recent. */
export function rankEvidence(items: EvidenceInput[], labels: RequirementLabels, titleWords: string[] = []): Evidence[] {
  const ranked = items.map((item) => {
    const skills = extractSkills(item.text);
    const covers = [
      ...skills.filter((s) => labels.required.has(s)),
      ...skills.filter((s) => labels.preferred.has(s) && !labels.required.has(s)),
      ...skills.filter((s) => labels.mentioned.has(s) && !labels.required.has(s) && !labels.preferred.has(s)),
    ];
    const words = titleWords.filter((w) => item.text.toLowerCase().includes(w)).length;
    const relevance =
      skills.filter((s) => labels.required.has(s)).length * 3 +
      skills.filter((s) => labels.preferred.has(s)).length * 2 +
      skills.filter((s) => labels.mentioned.has(s)).length +
      Math.min(words, 2);
    return { ...item, covers, relevance };
  });
  const score = (e: Evidence) => 0.5 * Math.min(e.relevance / 8, 1) + 0.3 * e.quality + 0.2 * e.recency + (e.kind === "bullet" ? 0.05 : 0);
  return ranked.sort((a, b) => score(b) - score(a));
}

/** "Reconciled 40+ accounts" -> "reconciled 40+ accounts", keeping acronyms and names. */
export function lowerFirst(text: string): string {
  const [first, ...rest] = text.split(" ");
  if (!first || /^[A-Z0-9]{2,}/.test(first) || /^[A-Z][a-z]+[A-Z]/.test(first)) return text;
  return [first[0].toLowerCase() + first.slice(1), ...rest].join(" ");
}

/** A resume line turned into a first-person sentence. Facts the person wrote as sentences stay as written. */
export function asSentence(text: string, opts: { org?: string | null; lead?: "at" | "also" | "none" } = {}): string {
  const clean = text.trim().replace(/[.;\s]+$/, "");
  const mine = /^(i|i'm|i've|my|we|our)\b/i.test(clean);
  if (mine) return `${clean[0].toUpperCase()}${clean.slice(1)}.`;
  const verb = lowerFirst(clean);
  if (opts.lead === "at" && opts.org) return `At ${opts.org}, I ${verb}.`;
  if (opts.lead === "also") return `I also ${verb}.`;
  return `I ${verb}.`;
}
