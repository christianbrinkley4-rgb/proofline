import { findVoiceIssues, findWeakOpener } from "@/lib/voice/rules";
import { OVERUSED_VERBS, WEAK_OPENER_SWAPS, isActionVerb, suggestVerbs } from "./verbs";

/**
 * Scores one bullet 0 to 100 against docs/research/RESUME-STANDARDS.md.
 * Every point lost comes with a plain reason and, where possible, a fix.
 */

export type BulletCheckId = "opener" | "number" | "result" | "method" | "length" | "clean" | "voice";

export type BulletCheck = {
  id: BulletCheckId;
  label: string;
  points: number;
  max: number;
  tip?: string;
};

export type BulletScore = { score: number; checks: BulletCheck[] };

const RESULT_CUES =
  /\b(resulting in|saving|saved|cutting|cut|reducing|reduced|increasing|increased|raising|raised|growing|grew|catching|caught|earning|earned|improving|improved|lowering|lowered|boosting|boosted|preventing|prevented|recovering|recovered|winning|won|placing|placed|from .{1,30} to|to \$?\d|with (zero|no|0) |within|ahead of|under budget|on time)\b/i;
const METHOD_CUES =
  /\b(by|using|with|through|via|in (excel|quickbooks|sql|python|tableau|power ?bi|sheets|salesforce|sap|netsuite|figma|r))\b/i;
const PRONOUNS = /\b(i|me|my|mine|we|our|us)\b/i;
const PASSIVE = /\b(was|were|been|being|is|are)\s+\w+ed\b/i;
const SPELLED_NUMBER = /\b(one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|half|double|triple)\b/i;

function firstWord(text: string): string {
  return text.trim().split(/\s+/)[0]?.replace(/[^A-Za-z-]/g, "") ?? "";
}

export function scoreBullet(raw: string): BulletScore {
  const text = raw.trim();
  const checks: BulletCheck[] = [];
  const word = firstWord(text);

  // Opener: 20
  const weak = findWeakOpener(text);
  if (weak) {
    const swaps = WEAK_OPENER_SWAPS[weak] ?? suggestVerbs(word);
    checks.push({ id: "opener", label: "Strong opening verb", points: 0, max: 20, tip: `"${capitalize(weak)}" is weak. Try ${list(swaps)}.` });
  } else if (isActionVerb(word)) {
    checks.push({ id: "opener", label: "Strong opening verb", points: 20, max: 20 });
  } else if (/ed$/i.test(word)) {
    checks.push({ id: "opener", label: "Strong opening verb", points: 14, max: 20, tip: `"${word}" works. ${list(suggestVerbs(word))} may land harder.` });
  } else {
    checks.push({ id: "opener", label: "Strong opening verb", points: 4, max: 20, tip: "Start with an action verb in the past tense, like Built, Reconciled, or Led." });
  }

  // Number: 20
  if (/\d/.test(text)) checks.push({ id: "number", label: "Has a real number", points: 20, max: 20 });
  else if (SPELLED_NUMBER.test(text)) checks.push({ id: "number", label: "Has a real number", points: 14, max: 20, tip: "Write the number as digits so it stands out." });
  else checks.push({ id: "number", label: "Has a real number", points: 0, max: 20, tip: "Add a number: how many, how much, or how often. Only one you can back up." });

  // Result: 15
  checks.push(
    RESULT_CUES.test(text) || /%/.test(text)
      ? { id: "result", label: "Says what changed", points: 15, max: 15 }
      : { id: "result", label: "Says what changed", points: 0, max: 15, tip: "Say what was better because of it: time saved, money, fewer errors, a win." },
  );

  // Method: 10
  checks.push(
    METHOD_CUES.test(text)
      ? { id: "method", label: "Says how", points: 10, max: 10 }
      : { id: "method", label: "Says how", points: 4, max: 10, tip: 'Add how you did it: "by...", "using...", or the tool.' },
  );

  // Length: 15 (one to two lines at resume size)
  const len = text.length;
  if (len >= 60 && len <= 200) checks.push({ id: "length", label: "One to two lines", points: 15, max: 15 });
  else if (len >= 40 && len <= 240)
    checks.push({ id: "length", label: "One to two lines", points: 8, max: 15, tip: len < 60 ? "A little thin. Add the result or the how." : "Getting long. Cut words that don't carry a fact." });
  else
    checks.push({ id: "length", label: "One to two lines", points: 0, max: 15, tip: len < 40 ? "Too short to show impact." : "Too long. Split it or cut to the strongest fact." });

  // Clean: 10
  const voice = findVoiceIssues(text);
  const pronoun = PRONOUNS.test(text);
  const cleanIssues = [
    ...(pronoun ? ["drop I, my, and we"] : []),
    ...voice.filter((v) => v.rule === "em-dash").map(() => "no em dashes"),
    ...voice.filter((v) => v.rule === "banned-phrase").map((v) => `cut "${v.match}"`),
  ];
  checks.push({
    id: "clean",
    label: "No pronouns or filler",
    points: Math.max(0, 10 - cleanIssues.length * 5),
    max: 10,
    tip: cleanIssues.length ? capitalize(cleanIssues.join(", ")) + "." : undefined,
  });

  // Voice: 10
  const voiceIssues = [
    ...(PASSIVE.test(text) ? ["rewrite in active voice"] : []),
    ...(OVERUSED_VERBS.has(word.toLowerCase()) ? [`"${word}" reads as AI-written; try ${list(suggestVerbs(word))}`] : []),
    ...(/\.$/.test(text) ? ["drop the period at the end"] : []),
  ];
  checks.push({
    id: "voice",
    label: "Sounds like a person",
    points: Math.max(0, 10 - voiceIssues.length * 5),
    max: 10,
    tip: voiceIssues.length ? capitalize(voiceIssues.join("; ")) + "." : undefined,
  });

  return { score: checks.reduce((s, c) => s + c.points, 0), checks };
}

/** Page-level check: no verb opens more than two bullets. */
export function repeatedOpeners(bullets: string[]): string[] {
  const counts = new Map<string, number>();
  for (const b of bullets) {
    const w = firstWord(b).toLowerCase();
    if (w) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n > 2).map(([w]) => capitalize(w));
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
