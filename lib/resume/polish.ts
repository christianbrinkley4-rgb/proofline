import { isActionVerb } from "./verbs";

/**
 * Small, safe fixes and checks that separate a good resume from a careless one.
 * Career-center guidance (Harvard's among it) lists the same top mistakes every
 * year: typos, missing contact details, inconsistent tense, and duties without
 * results. Fixes here never touch a number or a claim, only form.
 */

const IRREGULAR_PAST: Record<string, string> = {
  lead: "led",
  build: "built",
  write: "wrote",
  drive: "drove",
  grow: "grew",
  teach: "taught",
  oversee: "oversaw",
  draw: "drew",
  sell: "sold",
  speak: "spoke",
  win: "won",
  hold: "held",
  meet: "met",
  keep: "kept",
  begin: "began",
  bring: "brought",
  buy: "bought",
  catch: "caught",
  choose: "chose",
  find: "found",
  give: "gave",
  spend: "spent",
  send: "sent",
  run: "ran",
  make: "made",
  cut: "cut",
  set: "set",
  put: "put",
  read: "read",
};

/** Base forms to try for a word that might be "manages", "managing", or "manage". */
function bases(word: string): string[] {
  const w = word.toLowerCase();
  const out = [w];
  if (w.endsWith("ies")) out.push(`${w.slice(0, -3)}y`);
  if (w.endsWith("es")) out.push(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss")) out.push(w.slice(0, -1));
  if (w.endsWith("ing")) {
    const stem = w.slice(0, -3);
    out.push(stem, `${stem}e`);
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0, -1));
  }
  return out;
}

function pastForms(base: string): string[] {
  const forms = [IRREGULAR_PAST[base]].filter(Boolean) as string[];
  if (base.endsWith("e")) forms.push(`${base}d`);
  else if (/[^aeiou]y$/.test(base)) forms.push(`${base.slice(0, -1)}ied`);
  else forms.push(`${base}ed`, `${base}${base.at(-1)}ed`);
  return forms;
}

function matchCase(base: string, word: string): string {
  return word[0] === word[0].toUpperCase() ? base[0].toUpperCase() + base.slice(1) : base;
}

/** "Manage", "Manages", or "Managing" to "Managed", when the word is a known action verb. Null otherwise. */
export function toPastTense(word: string): string | null {
  const lower = word.toLowerCase();
  // "Exceeded" is already past. "Exceed" only looks past because the base ends in "ed".
  if ((/ed$/.test(lower) && isActionVerb(lower)) || Object.values(IRREGULAR_PAST).includes(lower)) return null;
  for (const base of bases(lower)) {
    const past = pastForms(base).find((p) => p !== lower && isActionVerb(p));
    if (past) return matchCase(past, word);
  }
  return null;
}

const IRREGULAR_PRESENT: Record<string, string> = Object.fromEntries(Object.entries(IRREGULAR_PAST).map(([base, past]) => [past, base]));

/** Past forms that doubled a final consonant ("Plan" to "Planned"), not roots that already end in a double ("Bill" to "Billed"). */
const DOUBLED = new Set(["logged", "mapped", "planned", "programmed"]);

/** Past forms that dropped a silent e ("Manage" to "Managed"). Every other action verb just loses "ed". */
const SILENT_E = new Set([
  "accelerated", "achieved", "collaborated", "communicated", "educated", "promoted", "accrued", "advised", "allocated", "analyzed", "arranged", "automated", "balanced",
  "calculated", "closed", "coded", "compared", "compiled", "completed", "configured", "consolidated", "coordinated",
  "created", "contributed", "delegated", "diagnosed", "disbursed", "doubled", "eliminated", "estimated", "evaluated", "examined",
  "facilitated", "filed", "guided", "handled", "improved", "increased", "introduced", "investigated", "invoiced",
  "managed", "measured", "mobilized", "moderated", "modernized", "negotiated", "organized", "persuaded", "placed",
  "prepared", "priced", "prioritized", "produced", "prototyped", "provided", "raised", "reconciled", "reduced",
  "resolved", "restructured", "saved", "scheduled", "secured", "served", "standardized", "streamlined", "supervised",
  "systematized", "translated", "tripled", "updated", "upgraded", "validated", "valued", "welcomed",
]);

/**
 * "Managed", "Drove", or "Built" to "Manage", "Drive", or "Build", when the word is a known action verb.
 * Null when it is already present, or when changing it would guess at a different verb.
 */
export function toPresentTense(word: string): string | null {
  if (toPastTense(word)) return null;
  const lower = word.toLowerCase();
  const irregular = IRREGULAR_PRESENT[lower];
  if (irregular) return irregular.toLowerCase() === lower ? null : matchCase(irregular, word);
  if (!isActionVerb(lower)) return null;
  const base = lower.endsWith("ied")
    ? `${lower.slice(0, -3)}y`
    : DOUBLED.has(lower)
      ? lower.slice(0, -3)
      : SILENT_E.has(lower)
        ? lower.slice(0, -1)
        : lower.endsWith("ed")
          ? lower.slice(0, -2)
          : null;
  if (!base || !pastForms(base).some((form) => form === lower && isActionVerb(form))) return null;
  return matchCase(base, word);
}

/**
 * Past tense when the date line shows an end, or when it is blank.
 * A blank line is not a current role. Present tense is for a line that says
 * the role or project is still going ("May 2025 – Present").
 */
export function roleEnded(dates: string): boolean {
  const line = dates.trim();
  if (!line) return true;
  return !/present|current|now/i.test(line);
}

/**
 * The same bullet, tidied: one space between words, no space before punctuation,
 * a capital first letter, no trailing period. The opening verb matches the entry:
 * present when the role or project is current, past when it ended or has no dates.
 * Only that first word changes, so a number or a later claim stays as confirmed.
 */
export function polishBullet(text: string, opts: { ended: boolean }): string {
  let out = text.replace(/\s+/g, " ").replace(/\s+([,.;:)])/g, "$1").replace(/\(\s+/g, "(").trim().replace(/\.+$/, "");
  if (out) out = out[0].toUpperCase() + out.slice(1);
  const first = out.match(/^[A-Za-z]+/)?.[0];
  const replacement = first ? (opts.ended ? toPastTense(first) : toPresentTense(first)) : null;
  if (first && replacement) out = replacement + out.slice(first.length);
  return out;
}

const NUMBER_WORDS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|hundred|thousand|half|twice|double[ds]?|triple[ds]?)\b/i;

/** Whether a bullet carries a measure: a digit, a percentage, or a counted word. */
export function hasNumber(text: string): boolean {
  return /\d/.test(text) || NUMBER_WORDS.test(text);
}

/** Proofreading problems a rule can see: doubled words, stray spacing, a lowercase start, unbalanced parentheses. */
export function proofread(text: string): string[] {
  const issues: string[] = [];
  const doubled = text.match(/\b([A-Za-z]+)\s+\1\b/i);
  if (doubled && !/^(that|had)$/i.test(doubled[1])) issues.push(`"${doubled[1]} ${doubled[1]}" is doubled`);
  if (/ {2,}/.test(text)) issues.push("extra spaces");
  if (/\s[,.;:]/.test(text)) issues.push("a space before punctuation");
  if (/^[a-z]/.test(text)) issues.push("starts with a lowercase letter");
  if ((text.match(/\(/g) ?? []).length !== (text.match(/\)/g) ?? []).length) issues.push("an unclosed parenthesis");
  return issues;
}

/**
 * One entry per skill on the Skills line. "Excel (pivot tables, XLOOKUP)" and
 * "Excel (pivot tables, VLOOKUP)" merge into "Excel (pivot tables, XLOOKUP, VLOOKUP)";
 * "SQL (basic)" and "SQL" keep the more specific one. Order follows first appearance.
 */
export function dedupeSkills(items: string[], canonicalOf: (item: string) => string | undefined): string[] {
  const groups = new Map<string, { head: string; details: string[] }>();
  for (const raw of items) {
    const item = raw.replace(/\s+/g, " ").trim();
    if (!item) continue;
    const key = (canonicalOf(item) ?? item).toLowerCase();
    const m = item.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    const head = (m ? m[1] : item).trim();
    const details = m ? m[2].split(/\s*,\s*/).filter(Boolean) : [];
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { head, details });
      continue;
    }
    for (const d of details) if (!group.details.some((x) => x.toLowerCase() === d.toLowerCase())) group.details.push(d);
  }
  return [...groups.values()].map((g) => (g.details.length ? `${g.head} (${g.details.join(", ")})` : g.head));
}

/** Skills that appear twice on a line, for the proofreading check. */
export function repeatedSkills(items: string[], canonicalOf: (item: string) => string | undefined): string[] {
  const seen = new Map<string, number>();
  for (const item of items) {
    const key = (canonicalOf(item) ?? item).toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return items.filter((item, i) => {
    const key = (canonicalOf(item) ?? item).toLowerCase();
    return (seen.get(key) ?? 0) > 1 && items.findIndex((x) => (canonicalOf(x) ?? x).toLowerCase() === key) === i;
  });
}

/** The name a skill goes by on the page: "SQL (basic)" and "SQL" share one; "Google Sheets" and "Excel" don't. */
export function skillName(item: string): string {
  return item.replace(/\s*\(.*\)\s*$/, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** An opener in present tense ("Manage", "Leading") that should be past tense for a role that's over. */
export function presentTenseOpener(text: string): string | null {
  const first = text.match(/^[A-Za-z]+/)?.[0];
  return first && toPastTense(first) ? first : null;
}
