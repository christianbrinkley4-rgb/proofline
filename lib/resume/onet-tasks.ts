import catalogData from "./onet-catalog.json";
import { extractSkills } from "@/lib/fit/skills";
import { findVoiceIssues, findWeakOpener } from "@/lib/voice/rules";
import { isActionVerb } from "./verbs";
import type { RoleTask } from "./role-tasks";

type Occupation = { code: string; title: string; aliases: string[]; tasks: Array<{ id: number; text: string; core: boolean }> };
const catalog = catalogData as { source: string; url: string; license: string; occupations: Occupation[] };
const titleCache = new Map<string, RoleTask[]>();
const generic = new Set(["a", "an", "and", "assistant", "associate", "at", "intern", "junior", "lead", "manager", "of", "senior", "specialist", "staff", "the"]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? [])
    .map((word) => word.replace(/(ing|ers|er|ists|ist|s)$/, ""))
    .filter((word) => word.length > 2 && !generic.has(word));
}

function occupationScore(title: string, occupation: Occupation): number {
  const query = tokens(title);
  if (!query.length) return 0;
  const choices = [occupation.title, ...occupation.aliases];
  let best = 0;
  for (const choice of choices) {
    const words = new Set(tokens(choice));
    const common = query.filter((word) => words.has(word)).length;
    const score = common / Math.max(query.length, words.size);
    if (score > best) best = score;
    if (best === 1) break;
  }
  return best;
}

const irregular: Record<string, string> = {
  build: "Built", buy: "Bought", catch: "Caught", choose: "Chose", do: "Did", draw: "Drew",
  find: "Found", give: "Gave", grow: "Grew", keep: "Kept", lead: "Led", make: "Made",
  meet: "Met", oversee: "Oversaw", pay: "Paid", read: "Read", run: "Ran", sell: "Sold",
  send: "Sent", set: "Set", teach: "Taught", write: "Wrote",
};

function pastTense(statement: string): string | null {
  const clean = statement.trim().replace(/\.$/, "");
  // Many O*NET tasks begin with several parallel verbs. Converting only the
  // first creates fragments such as "Reconciled or note and report ...".
  // Omit these until we can rewrite every verb safely.
  if (/\b(?:and|or)\s+(?:analyze|assess|check|collect|compare|coordinate|create|develop|document|evaluate|file|identify|inspect|interpret|maintain|monitor|note|perform|prepare|process|provide|quote|recommend|reconcile|record|report|resolve|review|sell|train|update|verify|write)\b/i.test(clean.slice(0, 75))) return null;
  const first = clean.match(/^([A-Za-z]+)\b/);
  if (!first) return null;
  const root = first[1].toLowerCase();
  const past = irregular[root] ?? (root.endsWith("e") ? `${root}d` : /[^aeiou]y$/.test(root) ? `${root.slice(0, -1)}ied` : `${root}ed`);
  const verb = past[0].toUpperCase() + past.slice(1);
  if (!isActionVerb(verb) || findWeakOpener(verb)) return null;
  return verb + clean.slice(first[0].length);
}

export function onetCatalogSize() {
  const eligible = catalog.occupations.reduce((sum, occupation) => sum + occupation.tasks.filter((item) => {
    const text = pastTense(item.text);
    return text && !/\d/.test(text) && text.length <= 220 && !findVoiceIssues(text).length;
  }).length, 0);
  return {
    occupations: catalog.occupations.length,
    tasks: catalog.occupations.reduce((sum, occupation) => sum + occupation.tasks.length, 0),
    eligible,
    potentialPrompts: eligible * 3,
  };
}

/** Result and method prompts appear only after the person confirms the base task. */
export function onetFollowupsForAccepted(tasks: RoleTask[], acceptedIds: Set<string>): RoleTask[] {
  const followups: RoleTask[] = [];
  for (const item of tasks) {
    if (!item.id.startsWith("onet:") || !acceptedIds.has(item.id) || item.template.length > 160) continue;
    if (!/\b(resulting in|which led to|so that)\b/i.test(item.template)) {
      followups.push({ ...item, id: `${item.id}:result`, template: `${item.template}, resulting in [what changed?]`, slot: "what changed?", related: [] });
    }
    if (!/\b(using|through|with| by )\b/i.test(item.template)) {
      followups.push({ ...item, id: `${item.id}:method`, template: `${item.template} using [which tool or method?]`, slot: "which tool or method?", related: [] });
    }
  }
  return followups;
}

/** Public occupational tasks become questions; no one has done them until they confirm. */
export function onetTasksForTitle(title: string | null, limit = 80): RoleTask[] {
  if (!title?.trim() || /\b(class|course|seminar|workshop)\b/i.test(title)) return [];
  const key = title.trim().toLowerCase();
  const cached = titleCache.get(key);
  if (cached) return cached.slice(0, limit);
  const scored = catalog.occupations
    .map((occupation) => ({ occupation, score: occupationScore(title, occupation) }))
    .sort((a, b) => b.score - a.score);
  // A loose alias match can connect "bookkeeping assistant" to a teaching
  // occupation whose alias is "bookkeeping instructor". Keep only matches
  // that are nearly as strong as the best occupation for this title.
  const best = scored[0]?.score ?? 0;
  const matches = scored.filter(({ score }) => score >= 0.4 && score >= best - 0.15).slice(0, 2);
  const out: RoleTask[] = [];
  for (const { occupation } of matches) {
    for (const item of [...occupation.tasks].sort((a, b) => Number(b.core) - Number(a.core))) {
      const text = pastTense(item.text);
      if (!text || /\d/.test(text) || text.length > 220 || findVoiceIssues(text).length) continue;
      const id = `onet:${occupation.code}:${item.id}`;
      out.push({ id, families: [], titleWords: [], template: text, skills: extractSkills(text), related: [`${id}:result`, `${id}:method`] });
      if (out.length >= Math.max(limit, 180)) break;
    }
  }
  if (titleCache.size >= 100) titleCache.clear();
  titleCache.set(key, out);
  return out.slice(0, limit);
}
