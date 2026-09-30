import { workWords } from "./recall-work";
import { recallWording } from "./recall-wording";
import catalogData from "./onet-catalog.json";
import { extractSkills } from "@/lib/fit/skills";
import { findVoiceIssues, findWeakOpener } from "@/lib/voice/rules";
import { isActionVerb, OVERUSED_VERBS } from "./verbs";
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

const titleSignatures = new Map(catalog.occupations.map((occupation) => [occupation.code,
  [occupation.title, ...occupation.aliases].map((choice) => new Set(tokens(choice))),
]));

function occupationScore(title: string, occupation: Occupation): number {
  const query = tokens(title);
  if (!query.length) return 0;
  const choices = titleSignatures.get(occupation.code) ?? [];
  let best = 0;
  for (const words of choices) {
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

function pastTense(statement: string, simple = false): string | null {
  let clean = statement.trim().replace(/\.$/, "");
  if (simple) {
    // Ask about a short action from a compound duty, rather than keeping a
    // sentence whose remaining imperative verbs would have the wrong tense.
    const split = clean.search(/(?:,\s*|\s+(?:and|or)\s+)(?:advise|answer|balance|count|design|discuss|handle|inspect|issue|label|load|measure|open|operate|order|pack|read|receive|repair|select|serve|ship|sort|stock|store|supervise|test|unload|unpack|use|analyze|assess|check|collect|compare|coordinate|create|determine|develop|direct|distribute|document|escort|evaluate|file|identify|inspect|interpret|maintain|monitor|note|perform|prepare|process|provide|quote|recommend|reconcile|record|report|resolve|review|sell|train|update|verify|write)\b/i);
    if (split > 0) {
      const prefix = clean.slice(0, split).replace(/[,\s]+$/, "");
      if (/\b(?:to|and|or|for|by|using|with|through|including|such as|to determine|to analyze|to record|to store)$/i.test(prefix)) return null;
      if (prefix.split(/\s+/).length >= 2 && !/\b(by|using|such as)\b/i.test(prefix)) clean = prefix;
      else if (/\b(by|using|such as)\b/i.test(prefix)) { /* A method list can contain nouns such as "check". */ }
      else return null;
    }
  }
  // Many O*NET tasks begin with several parallel verbs. Converting only the
  // first creates fragments such as "Reconciled or note and report ...".
  // Omit these until we can rewrite every verb safely.
  if (/\b(?:and|or)\s+(?:advise|answer|balance|count|design|discuss|handle|inspect|issue|label|load|measure|open|operate|order|pack|read|receive|repair|select|serve|ship|sort|stock|store|supervise|test|unload|unpack|use|analyze|assess|check|collect|compare|coordinate|create|develop|document|evaluate|file|identify|inspect|interpret|maintain|monitor|note|perform|prepare|process|provide|quote|recommend|reconcile|record|report|resolve|review|sell|train|update|verify|write)\b/i.test(clean.slice(0, 75))) return null;
  const first = clean.match(/^([A-Za-z]+)\b/);
  if (!first) return null;
  const root = first[1].toLowerCase();
  const past = irregular[root] ?? (root.endsWith("e") ? `${root}d` : /[^aeiou]y$/.test(root) ? `${root.slice(0, -1)}ied` : `${root}ed`);
  const verb = past[0].toUpperCase() + past.slice(1);
  if ((!isActionVerb(verb) && !(simple && /^(Operated|Received|Transmitted|Performed|Distributed|Escorted|Sorted|Filed)$/.test(verb))) || findWeakOpener(verb)) return null;
  return (verb + clean.slice(first[0].length)).replace(/[,\s]+$/, "");
}

/**
 * Job-description padding a person would never write about their own work.
 * Only words that carry no fact are cut, so the task still means the same thing.
 */
export function plainDuty(text: string): string {
  return text
    .replace(/\b(?:various|assorted|appropriate|applicable|relevant|specified|designated)\s+(?=\w)/gi, "")
    .replace(/\bin order to\b/gi, "to")
    .replace(/\b(?:persons|individuals)\b(?! or businesses)/gi, "people")
    .replace(/,?\s+(?:as needed|as required|as necessary|as appropriate|when necessary|where appropriate)(?=[,.]|$)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Counts distinct usable common duties, rather than inflating the bank with variants. */
function commonDuty(statement: string): string | null {
  const raw = recallWording(statement) ?? pastTense(statement, true);
  const text = raw ? plainDuty(raw) : null;
  if (!text || /\d/.test(text) || text.length > 220 || findVoiceIssues(text).length || findWeakOpener(text)) return null;
  const verb = text.split(/\s+/)[0];
  return isActionVerb(verb) && !OVERUSED_VERBS.has(verb.toLowerCase()) ? text : null;
}

/** The same common duties used by role matching, exposed for full-bank audits. */
export function recallDutyTemplates(): string[] {
  return [...new Set(catalog.occupations.flatMap((occupation) => occupation.tasks.filter((task) => task.core).map((task) => commonDuty(task.text)).filter((text): text is string => Boolean(text))))];
}

export function recallCatalogSize() {
  const duties = new Set<string>();
  let coreTasks = 0;
  for (const occupation of catalog.occupations) for (const task of occupation.tasks) {
    if (!task.core) continue;
    coreTasks++;
    const text = commonDuty(task.text);
    if (text) duties.add(text.toLowerCase());
  }
  return { occupations: catalog.occupations.length, tasks: catalog.occupations.reduce((sum, item) => sum + item.tasks.length, 0), coreTasks, distinctDuties: duties.size };
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
export function onetTasksForTitle(title: string | null, limit = 80, commonOnly = false, context = ""): RoleTask[] {
  if (!title?.trim() || /\b(class|course|seminar|workshop)\b/i.test(title)) return [];
  const key = `${commonOnly ? "common:" : "all:"}${title.trim().toLowerCase()}:${commonOnly ? context.toLowerCase() : ""}`;
  const cached = titleCache.get(key);
  if (cached) return cached.slice(0, limit);
  // Employment labels describe the arrangement, not a different occupation.
  const matchTitle = commonOnly ? title.replace(/\b(?:part[ -]time|full[ -]time|temporary|contract|seasonal|freelance)\b/gi, " ") : title;
  const scored = catalog.occupations
    .map((occupation) => {
      const score = occupationScore(matchTitle, occupation);
      const occupationWords = new Set(tokens([occupation.title, ...occupation.aliases].join(" ")));
      const titleWords = new Set(tokens(matchTitle));
      const contextMatches = commonOnly && score >= 0.65 ? [...new Set(tokens(context))].filter((word) => !titleWords.has(word) && occupationWords.has(word)).length : 0;
      const officialWords = new Set(tokens(occupation.title));
      const officialMatch = commonOnly && score >= 0.65 && officialWords.size === titleWords.size && [...titleWords].every((word) => officialWords.has(word));
      return { occupation, score: score + (officialMatch ? 0.2 : 0) + Math.min(contextMatches * 0.15, 0.3) };
    })
    .sort((a, b) => b.score - a.score);
  // A loose alias match can connect "bookkeeping assistant" to a teaching
  // occupation whose alias is "bookkeeping instructor". Keep only matches
  // that are nearly as strong as the best occupation for this title.
  const best = scored[0]?.score ?? 0;
  const matches = scored.filter(({ score }) => score >= (commonOnly ? 0.65 : 0.4) && score >= best - (commonOnly ? 0.1 : 0.15)).slice(0, 2);
  const out: RoleTask[] = [];
  for (const { occupation } of matches) {
    for (const item of [...occupation.tasks].sort((a, b) => Number(b.core) - Number(a.core))) {
      if (commonOnly && !item.core) continue;
      const text = commonOnly ? commonDuty(item.text) : pastTense(item.text);
      if (!text || /\d/.test(text) || text.length > 220 || findVoiceIssues(text).length) continue;
      if (commonOnly && (!isActionVerb(text.split(/\s+/)[0]) || OVERUSED_VERBS.has(text.split(/\s+/)[0].toLowerCase()) || findWeakOpener(text))) continue;
      const id = `onet:${occupation.code}:${item.id}`;
      out.push({ id, families: [], titleWords: [], template: text, skills: extractSkills(text), common: item.core, related: [`${id}:result`, `${id}:method`] });
      if (out.length >= Math.max(limit, 180)) break;
    }
  }
  if (titleCache.size >= 100) titleCache.clear();
  titleCache.set(key, out);
  return out.slice(0, limit);
}


/** A plain explanation of the occupation behind a common-task card. */
export function occupationLabelForTask(taskId: string | null): string | null {
  if (!taskId?.startsWith("onet:")) return null;
  const code = taskId.split(":")[1];
  return catalog.occupations.find((occupation) => occupation.code === code)?.title ?? null;
}


const broadRoleWords = new Set(["assist", "associat", "intern", "lead", "manag", "senior", "junior", "specialist", "staff", "worker", "work", "own", "member", "volunteer", "profession", "general"]);
let contextSignatures: Array<{ occupation: Occupation; aliases: Set<string>[]; tasks: Set<string>[] }> | undefined;
let aliasFrequency: Map<string, number> | undefined;

/** General fallback for unfamiliar titles and non-job activities with specific work clues. */
export function onetTasksForContext(context: string): RoleTask[] {
  const query = new Set(workWords(context).split(" ").filter(Boolean));
  if (query.size < 3) return [];
  if (!contextSignatures) {
    contextSignatures = catalog.occupations.filter((occupation) => occupation.tasks.some((task) => task.core)).map((occupation) => ({
      occupation,
      aliases: [occupation.title, ...occupation.aliases].map((alias) => new Set(workWords(alias).split(" ").filter((word) => word && !broadRoleWords.has(word)))),
      tasks: occupation.tasks.filter((task) => task.core).map((task) => new Set(workWords(task.text).split(" ").filter(Boolean))),
    }));
    aliasFrequency = new Map();
    for (const item of contextSignatures) for (const word of new Set(item.aliases.flatMap((alias) => [...alias]))) aliasFrequency.set(word, (aliasFrequency.get(word) ?? 0) + 1);
  }
  const matches = contextSignatures.flatMap(({ occupation, aliases, tasks }) => {
    const alias = aliases.find((terms) => terms.size > 0 && [...terms].every((term) => query.has(term)) &&
      (terms.size >= 2 || (aliasFrequency?.get([...terms][0]) ?? 1000) <= 8));
    if (!alias) return [];
    // A title word alone is not enough: the person's activity must also connect
    // to a rated duty. This prevents broad interests or one tool from selecting a role.
    const proof = Math.max(0, ...tasks.map((terms) => [...terms].filter((term) => query.has(term) && !alias.has(term) && !broadRoleWords.has(term)).length));
    if (proof < 2) return [];
    return [{ occupation, score: alias.size + Math.min(proof, 5) * 0.25 }];
  }).sort((a, b) => b.score - a.score);
  return [...new Map(matches.slice(0, 2).flatMap(({ occupation }) => onetTasksForTitle(occupation.title, 180, true, context)).map((task) => [task.id, task])).values()];
}
