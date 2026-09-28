import { extractSkills } from "@/lib/fit/skills";

/**
 * Keyword phrases a posting uses, lowercased and singular, so "Journal Entries"
 * and "journal entry" are one keyword. Three sources, strongest first:
 *  1. Skills from the shared taxonomy (lib/fit/skills.ts), named canonically.
 *  2. Tool and acronym tokens the posting writes in capitals ("SQL", "NetSuite", "ASC 606").
 *  3. Two-word phrases the posting repeats ("vendor payment", "patient intake").
 * Boilerplate (benefits, equal-opportunity text) is ignored. Deterministic, no model.
 */

const STOP = new Set(
  (
    "a an and are as at be been being but by can could did do does for from had has have how i if in into is it its may might must " +
    "not of on or our out over per so such than that the their them then there these they this those to under up us was we were what " +
    "when where which while who will with within without you your yours able ability across also any based both each etc every " +
    "including include includes new one other own part plus related role roles skill skills strong team teams well work working " +
    "year years experience experienced knowledge understanding preferred required requirement requirements qualification qualifications " +
    "responsibility responsibilities opportunity opportunities candidate candidates position job company business day days time " +
    "great good excellent help helping support supporting ensure provide providing using use used make making join looking"
  ).split(/\s+/),
);

/** Capitalized tokens that are almost never skills. */
const NOT_TOOLS = new Set(["US", "USA", "EEO", "EOE", "LLC", "LLP", "INC", "CEO", "CFO", "HR", "PTO", "ADA", "OK", "I", "NA", "TBD", "FAQ", "AM", "PM", "EST", "PST", "N/A"]);

const STATE_CODES = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "),
);

const BOILERPLATE = /(equal (employment )?opportunity|\beeo\b|reasonable accommodation|benefits|401\(k\)|paid time off|\bpto\b|health insurance|dental|vision insurance|background check|drug[- ]free|e-verify)/i;

/** "entries" -> "entry", "classes" -> "class", "analysis" stays. */
export function singular(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3 || /(ss|us|is|ous|ics|ess)$/.test(w)) return w;
  if (/ies$/.test(w)) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Lowercase, singular words, single spaces; keeps +, #, /, . inside tokens ("c++", "asc 606"). */
export function normalizePhrase(phrase: string): string {
  return phrase
    .replace(/[^A-Za-z0-9+#/.\s-]/g, " ")
    .replace(/(^|\s)[-./]+|[-./]+(?=\s|$)/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    // Brand names with an inner capital ("QuickBooks", "NetSuite") keep their final s.
    .map((word) => (/[a-z][A-Z]/.test(word) ? word.toLowerCase() : singular(word)))
    .join(" ");
}

export function extractKeywords(description: string | null | undefined, limit = 25): string[] {
  const text = (description ?? "")
    .split("\n")
    .filter((line) => !BOILERPLATE.test(line))
    .join("\n");
  if (!text.trim()) return [];
  const weights = new Map<string, number>();
  const add = (phrase: string, weight: number) => {
    const key = normalizePhrase(phrase);
    if (!key || key.length < 2 || STOP.has(key)) return;
    weights.set(key, (weights.get(key) ?? 0) + weight);
  };

  for (const skill of extractSkills(text)) add(skill, 6);

  for (const match of text.matchAll(/\bASC\s?\d{3}\b|\b[A-Z][a-zA-Z0-9]*[A-Z0-9+#][a-zA-Z0-9+#.]*\b|\b[A-Z]{2,}\b/g)) {
    const token = match[0].replace(/\.$/, "");
    if (NOT_TOOLS.has(token.toUpperCase()) || token.length < 2 || /^\d+$/.test(token)) continue;
    // "Raleigh, NC": a state code is a place, not a skill.
    if (/^[A-Z]{2}$/.test(token) && STATE_CODES.has(token)) continue;
    add(token, 2);
  }

  const words = text.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);
  const bigrams = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const [a, b] = [words[i], words[i + 1]];
    if (STOP.has(a) || STOP.has(b) || a.length < 3 || b.length < 3 || /^\d/.test(a) || /^\d/.test(b)) continue;
    const key = normalizePhrase(`${a} ${b}`);
    bigrams.set(key, (bigrams.get(key) ?? 0) + 1);
  }
  for (const [phrase, count] of bigrams) if (count >= 2) add(phrase, count);

  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([phrase]) => phrase);
  // Drop a keyword already inside a stronger phrase: "ledger" under "general ledger",
  // "month end" and "end close" under "month-end close".
  const kept: string[] = [];
  const spaced = (p: string) => ` ${p.replace(/-/g, " ")} `;
  for (const phrase of ranked) {
    if (kept.some((k) => k !== phrase && spaced(k).includes(spaced(phrase)))) continue;
    kept.push(phrase);
    if (kept.length >= limit) break;
  }
  return kept;
}

/** Which keywords a body of text shows, by normalized phrase or by the same canonical skill. */
export function matchKeywords(keywords: string[], text: string): { matched: string[]; missing: string[] } {
  const normalized = ` ${normalizePhrase(text)} `;
  const skills = new Set(extractSkills(text).map(normalizePhrase));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const keyword of keywords) {
    const hit = normalized.includes(` ${keyword} `) || skills.has(keyword) || extractSkills(keyword).some((s) => skills.has(normalizePhrase(s)));
    (hit ? matched : missing).push(keyword);
  }
  return { matched, missing };
}
