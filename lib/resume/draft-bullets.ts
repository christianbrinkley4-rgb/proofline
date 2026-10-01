import { dashesToCommas, findVoiceIssues } from "@/lib/voice/rules";
import { composeRecallXyz } from "./recall-xyz";
import { hasNumber, toPastTense, toPresentTense } from "./polish";
import { isActionVerb } from "./verbs";
import { gerund } from "./xyz";

/**
 * Recommended resume lines from what a person said a role involved.
 *
 * Every word comes from their description. The drafter only changes form: it
 * drops "I" and "responsible for", puts the verbs in the right tense, and leads
 * with a result when they named one ("which cut wait times in half"). It never
 * adds a number, a result, or a tool. A line without a number gets one optional
 * question instead, and only their answer can add one.
 *
 * A draft is not a fact. It reaches a resume only after the person keeps it or
 * rewrites it, and the server checks a kept draft against the words it came from.
 */

export type DraftLine = {
  key: string;
  /** The part of their description this line came from, in their words. */
  source: string;
  /** What they did, tidied, without the result. */
  action: string;
  /** What came of it, in their words, if they said. */
  result: string;
  text: string;
  /** One optional follow-up when the line has no number. Null when it already has one. */
  question: string | null;
  example: string | null;
};

export type DraftInput = { kind: string; ended: boolean; description: string };

export const MAX_DRAFTS = 4;

/** Everyday verbs people use for their work, base form to past. Most aren't resume "action verbs", and don't need to be. */
const PLAIN_PAST: Record<string, string> = {
  help: "helped", work: "worked", make: "made", do: "did", take: "took", clean: "cleaned", cook: "cooked", stock: "stocked",
  restock: "restocked", open: "opened", close: "closed", count: "counted", run: "ran", teach: "taught", watch: "watched",
  keep: "kept", set: "set", put: "put", give: "gave", get: "got", talk: "talked", answer: "answered", greet: "greeted",
  ring: "rang", sell: "sold", wash: "washed", fold: "folded", unload: "unloaded", load: "loaded", drive: "drove",
  deliver: "delivered", sort: "sorted", file: "filed", type: "typed", call: "called", post: "posted", edit: "edited",
  film: "filmed", shoot: "shot", design: "designed", code: "coded", write: "wrote", tutor: "tutored", coach: "coached",
  plan: "planned", host: "hosted", lead: "led", bake: "baked", serve: "served", prep: "prepped", mop: "mopped",
  stack: "stacked", pack: "packed", ship: "shipped", babysit: "babysat", mow: "mowed", lift: "lifted", carry: "carried",
  move: "moved", fix: "fixed", paint: "painted", build: "built", check: "checked", use: "used", learn: "learned",
  show: "showed", explain: "explained", sit: "sat", attend: "attended", shadow: "shadowed", observe: "observed",
  organize: "organized", reorganize: "reorganized", update: "updated", manage: "managed", order: "ordered", grow: "grew",
  stay: "stayed", visit: "visited", walk: "walked", feed: "fed", care: "cared", look: "looked", find: "found",
  meet: "met", send: "sent", buy: "bought", pay: "paid", bring: "brought", sing: "sang", play: "played", referee: "refereed",
  lifeguard: "lifeguarded", record: "recorded", track: "tracked", text: "texted", email: "emailed", fill: "filled",
};
const PLAIN_BASE: Record<string, string> = Object.fromEntries(Object.entries(PLAIN_PAST).map(([base, past]) => [past, base]));

/** Possible base forms of "helps", "helping", "running", "making". */
function baseCandidates(word: string): string[] {
  const out = [word];
  if (word.endsWith("ies")) out.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("es")) out.push(word.slice(0, -2));
  if (word.endsWith("s") && !word.endsWith("ss")) out.push(word.slice(0, -1));
  if (word.endsWith("ing")) {
    const stem = word.slice(0, -3);
    out.push(stem, `${stem}e`);
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0, -1));
  }
  return out;
}

/** The past form of a verb, or null when the word isn't one we know as a verb. */
function pastOf(word: string): string | null {
  const w = word.toLowerCase();
  if (PLAIN_BASE[w] || (isActionVerb(w) && !toPastTense(w))) return w;
  for (const base of baseCandidates(w)) if (PLAIN_PAST[base]) return PLAIN_PAST[base];
  const action = toPastTense(w);
  if (action) return action.toLowerCase();
  if (/^[a-z]{3,}ed$/.test(w)) return w;
  return null;
}

/** The present form ("run", "plan") for a role the person still has. */
function presentOf(word: string): string | null {
  const w = word.toLowerCase();
  for (const base of baseCandidates(w)) if (PLAIN_PAST[base]) return base;
  if (PLAIN_BASE[w]) return PLAIN_BASE[w];
  const past = pastOf(w);
  if (!past) return null;
  return toPresentTense(past)?.toLowerCase() ?? (past.endsWith("ed") ? past.slice(0, -2) : null);
}

const isPastForm = (word: string) => {
  const w = word.toLowerCase();
  return Boolean(PLAIN_BASE[w]) || (/ed$/.test(w) && pastOf(w) === w) || (isActionVerb(w) && !toPastTense(w));
};

function verbish(word: string): boolean {
  return pastOf(word.replace(/[^A-Za-z']/g, "")) !== null;
}

/** Openers that say less than the person did. Each swap keeps the claim the same size. */
const OPENER_SWAPS: Array<[RegExp, string]> = [
  [/^(?:work(?:ed|s|ing)?|ran|run|runs|running)\s+(?:the\s+|a\s+)?(?:cash\s+)?register\b/i, "operated the cash register"],
  [/^(?:work(?:ed|s|ing)?)\s+(?:at\s+)?(?:the\s+)?front\s+desk\b/i, "staffed the front desk"],
  [/^(?:did|do|does|doing)\s+/i, "handled "],
  [/^(?:helped|help|helps|helping)\s+(?:out\s+)?with\s+/i, "supported "],
];

/** "I was responsible for", "My job was to", "Mostly": wrappers around the real duty. */
const LEAD_FILLER = [
  /^(?:and|also|then|so|plus|basically|mostly|mainly|usually|sometimes|often|primarily|i\s+also|i\s+would|i'd|i'm|i\s+am|i\s+was|i\s+have|i've|i|we)\s+/i,
  /^(?:my\s+)?(?:main\s+|daily\s+|day-to-day\s+)?(?:job|role|duties|duty|responsibilities|tasks|work)\s+(?:was|were|included|include|involved|involve|consisted\s+of)\s+(?:to\s+)?/i,
  /^(?:responsible\s+for|in\s+charge\s+of|tasked\s+with|duties\s+included)\s+/i,
];

const PARTICLES = /^(?:up|out|in|down|off|over|on|away|back)$/i;
const RESULT_SPLIT = /,?\s+(so\s+that|so|which|resulting\s+in|that\s+way|and\s+that)\s+(.+)$/i;
const CHANGE_START = /^(?:it\s+|this\s+|that\s+)?(reduced|increased|improved|raised|grew|cut|lowered|shortened|saved|doubled|tripled|boosted|recovered|eliminated|prevented)\b/i;
const STOP = /^(?:for|at|in|on|to|with|by|using|from|during|so|and|or|while|when|into|across|per|each|every|a|an|the|about|around|our|my|their)$/i;
/** Things nobody counts on a resume: "About how many notes?" is a silly question. */
const UNCOUNTED = new Set(["notes", "shelves", "supplies", "materials", "records", "files", "things", "tasks", "duties", "needs", "questions", "phones", "items", "goods", "products"]);
const NOUN_SWAP: Record<string, string> = { phones: "calls" };

/** A line that already says how many or how often doesn't need the question. */
const isMeasured = (text: string) => hasNumber(text) || /\b(?:every|each|daily|weekly|monthly|nightly|once|twice)\b/i.test(text);

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function stripFiller(value: string): string {
  let text = value.trim();
  for (let i = 0; i < 4; i++) {
    const before = text;
    for (const pattern of LEAD_FILLER) text = text.replace(pattern, "");
    if (text === before) break;
  }
  return text;
}

/** Duties in a sentence that starts with a verb: split where a new list item opens with a verb. */
function splitVerbList(sentence: string): string[] {
  const out: string[] = [];
  const pieces = sentence.split(/(,\s*(?:and\s+|then\s+)?|\s+and\s+(?:then\s+)?(?:i\s+)?(?:also\s+)?)/i);
  let current = pieces[0];
  for (let i = 1; i < pieces.length; i += 2) {
    const part = pieces[i + 1] ?? "";
    const words = stripFiller(part).split(/\s+/).filter(Boolean);
    // "cleaned and restocked shelves" and "set up and cleaned up" stay whole: the first half isn't a duty on its own.
    const substantial = current.trim().split(/\s+/).filter((w) => !PARTICLES.test(w)).length >= 2;
    if (words.length >= 2 && verbish(words[0]) && substantial) {
      out.push(current);
      current = part;
    } else current = `${current}${pieces[i]}${part}`;
  }
  out.push(current);
  return out;
}

/** Splits a description into separate duties: lines, sentences, and lists. */
export function splitDuties(description: string): string[] {
  const text = dashesToCommas(description)
    .replace(/\r/g, "")
    .replace(/^[\s•*·-]+/gm, "")
    .replace(/,?\s*\betc\b\.?/gi, "");
  const sentences = text.split(/\n+|(?<=[.!?;])\s+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const sentence of sentences) {
    const first = stripFiller(sentence).split(/\s+/)[0] ?? "";
    // "Customer service, cash handling, opening and closing": a list of things, one per comma.
    if (!verbish(first) && sentence.includes(",")) out.push(...sentence.split(/,\s*(?:and\s+)?/));
    else out.push(...splitVerbList(sentence));
  }
  return out.map((s) => s.trim().replace(/[.!?;,\s]+$/, "")).filter((s) => s.split(/\s+/).length >= 2 || /ing$/i.test(s.trim()));
}

/** Puts the opening verb, and any verb joined to it by "and", in the tense the role needs. */
function setTense(text: string, ended: boolean, keepPast: boolean): string {
  const words = text.split(" ");
  const fix = (word: string) => {
    const lower = word.toLowerCase();
    if (!ended && keepPast && isPastForm(lower)) return lower;
    return (ended ? pastOf(lower) : presentOf(lower)) ?? lower;
  };
  words[0] = fix(words[0]);
  for (let i = 1; i < words.length - 1; i++) {
    // "opening and closing the store": the second verb follows the first.
    if (/^and$/i.test(words[i]) && /ing$/i.test(words[i + 1]) && verbish(words[i + 1])) words[i + 1] = fix(words[i + 1]);
  }
  return capitalize(words.join(" "));
}

/** One duty in resume form: no "I", the right tense, a plain opener. Returns null when there's no duty in it. */
function tidyDuty(raw: string, ended: boolean): string | null {
  const wasCharge = /^(?:i\s+was\s+)?in\s+charge\s+of\s+/i.test(raw.trim());
  let text = stripFiller(raw).replace(/\s+/g, " ").replace(/\bour\b/gi, "the").trim();
  if (!text) return null;
  for (const [pattern, swap] of OPENER_SWAPS) {
    if (pattern.test(text)) {
      text = text.replace(pattern, swap);
      break;
    }
  }
  const first = text.split(" ")[0];
  // A past verb in a current role is something finished ("grew the club to 45"), so it stays past.
  const keepPast = isPastForm(first.toLowerCase());
  if (!verbish(first)) {
    if (text.split(" ").length > 6 && !wasCharge) return null;
    // "in charge of the closing shift" is ownership the person stated. A bare noun duty ("customer service") was handled.
    text = `${wasCharge ? "oversaw" : "handled"} ${text.replace(/\s+handling$/i, "").replace(/^\w/, (c) => c.toLowerCase())}`;
  }
  text = text
    .replace(/\s+(?:and so on|and stuff|and things|and more)$/i, "")
    .replace(/[.!?;,\s]+$/, "")
    // "the register, about 50 customers a shift" reads as one line: "the register for about 50 customers a shift".
    .replace(/,\s+((?:about|around|roughly|nearly|over|up to|at least)\s+)?(\d[\d,.]*\s+[a-z]+s\b.*)$/i, (_all, approx: string | undefined, rest: string) => ` for ${approx ?? ""}${rest}`);
  return setTense(text, ended, keepPast);
}

function questionFor(action: string, kind: string): { question: string; example: string } {
  const object: string[] = [];
  for (const word of action.split(" ").slice(1)) {
    if (STOP.test(word) && object.length) break;
    if (!STOP.test(word)) object.push(word.replace(/[^A-Za-z'-]/g, ""));
  }
  const head = (object.at(-1) ?? "").toLowerCase();
  const shift = kind === "work" || kind === "internship";
  const counted = NOUN_SWAP[head] ?? head;
  if (/[a-z]s$/.test(head) && !/ss$/.test(head) && !UNCOUNTED.has(counted)) {
    const noun = NOUN_SWAP[head] ? counted : object.slice(-2).join(" ").toLowerCase();
    return { question: `About how many ${noun}?`, example: `For example: about 30 ${shift ? "a shift" : "a week"}` };
  }
  return { question: "Can you put a number on it, like how many or how often?", example: shift ? "For example: about 30 customers a shift" : "For example: 12 people every week" };
}

/** "Cut search time in half by reorganizing the shared drive." Their result first, then how. */
function leadWithResult(action: string, result: string, ended: boolean): string | null {
  const cleaned = result.replace(/^(?:it|this|that)\s+/i, "").replace(/[.!?;,\s]+$/, "");
  if (!CHANGE_START.test(cleaned)) return null;
  const [verb, ...rest] = action.split(" ");
  const past = pastOf(verb);
  if (!past) return null;
  return `${setTense(cleaned, ended, true)} by ${gerund(past)}${rest.length ? ` ${rest.join(" ")}` : ""}`;
}

/** The finished line for one duty. */
function lineFor(source: string, kind: string, ended: boolean, index: number): DraftLine | null {
  const split = source.match(RESULT_SPLIT);
  const resultWords = split && split[2].split(/\s+/).length >= 2 ? split[2].trim().replace(/[.!?;,\s]+$/, "") : "";
  const action = tidyDuty(resultWords ? source.slice(0, split!.index) : source, ended);
  if (!action) return null;
  const connector = resultWords ? split![1].toLowerCase().replace(/\s+/g, " ") : "";
  const text = resultWords
    ? leadWithResult(action, resultWords, ended) ?? `${action}${connector === "which" || connector === "resulting in" ? `, ${connector}` : ` ${connector}`} ${resultWords}`
    : action;
  if (findVoiceIssues(text).length) return null;
  const ask = isMeasured(text) ? null : questionFor(action, kind);
  return { key: `d${index}`, source: source.trim(), action, result: resultWords, text, question: ask?.question ?? null, example: ask?.example ?? null };
}

/**
 * Two to four recommended lines for a role, from their description. Fewer when
 * the description holds fewer duties: the drafter never pads with made-up work.
 */
export function draftBullets(input: DraftInput): DraftLine[] {
  const seen = new Set<string>();
  const lines: Array<DraftLine & { rank: number; order: number }> = [];
  for (const [order, duty] of splitDuties(input.description).entries()) {
    const line = lineFor(duty, input.kind, input.ended, order);
    if (!line) continue;
    const key = line.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    // When there are too many, keep lines with a number, then a result, then more detail.
    const rank = (hasNumber(line.text) ? 4 : 0) + (line.result ? 2 : 0) + Math.min(line.text.split(" ").length, 14) / 14;
    lines.push({ ...line, rank, order });
  }
  return lines
    .sort((a, b) => b.rank - a.rank || a.order - b.order)
    .slice(0, MAX_DRAFTS)
    .sort((a, b) => a.order - b.order)
    .map((line): DraftLine => ({ key: line.key, source: line.source, action: line.action, result: line.result, text: line.text, question: line.question, example: line.example }));
}

/**
 * The same line with the number they gave in answer to its question. Throws with
 * a plain reason when the number doesn't fit cleanly, so they can edit it instead.
 */
export function draftWithAnswer(line: Pick<DraftLine, "action" | "result">, answer: string, ended: boolean): string {
  const measure = answer.trim().replace(/[.\s]+$/, "");
  if (!measure) throw new Error("Type a number, or skip the question.");
  if (!/\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|daily|weekly|monthly|every|each)\b/i.test(measure)) {
    throw new Error("Answer with a number, like \"about 30 a shift\".");
  }
  const [first, ...rest] = line.action.split(" ");
  let composed: string;
  try {
    // The composer places the number; it only knows resume action verbs, so an everyday verb
    // ("Made coffee drinks") stands in as "Prepared" while it works and goes back after.
    const known = isActionVerb(first) || isActionVerb(pastOf(first) ?? "");
    const stand = known ? line.action : ["Prepared", ...rest].join(" ");
    composed = composeRecallXyz(stand, { measure, method: "", result: line.result }, true);
    if (!known) composed = composed.replace(/^Prepared\b/, capitalize(pastOf(first) ?? first));
  } catch {
    throw new Error("I couldn't fit that number in cleanly. Use Edit to write the line your way.");
  }
  const text = setTense(composed, ended, isPastForm(first.toLowerCase()));
  if (findVoiceIssues(text).length) throw new Error("Use Edit to write the line your way.");
  return text;
}

/** Numbers in a line, as written: "about 50", "3.5", "20%". */
export function numbersIn(text: string): string[] {
  return text.match(/\d[\d,]*(?:\.\d+)?/g)?.map((n) => n.replace(/,/g, "")) ?? [];
}

/**
 * Numbers a kept draft shows that the person never typed. A kept draft must
 * have none; an edited line is in their own words and is checked by them.
 */
export function unsupportedNumbers(text: string, sources: string[]): string[] {
  const known = new Set(sources.flatMap(numbersIn));
  return numbersIn(text).filter((n) => !known.has(n));
}
