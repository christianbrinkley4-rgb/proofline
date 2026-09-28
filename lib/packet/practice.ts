import { claimNumbers } from "@/lib/review/linter";
import { findVoiceIssues } from "@/lib/voice/rules";
import type { PrepQuestion, QuestionCategory } from "./interview";

/**
 * Feedback on a practiced interview answer, from rules only. It can't judge how
 * convincing someone sounds; it checks what an interviewer listens for: length,
 * the shape of a story, whose work it was, and whether every number said out
 * loud is one the person has confirmed.
 */

export type PracticeNote = { tone: "good" | "fix"; text: string };
export type PracticeFeedback = { words: number; seconds: number; notes: PracticeNote[] };

/** Conversational speaking pace. */
export const WORDS_PER_MINUTE = 140;

/** Seconds a good answer takes, by kind of question. */
const TARGET: Record<QuestionCategory, [number, number]> = {
  intro: [45, 90],
  motivation: [30, 75],
  skill: [60, 120],
  behavioral: [60, 120],
  gap: [30, 75],
};

const SITUATION = /\b(when|while|during|at the time|there was|we had|i had|the problem|the goal|my job was|i was working|our team)\b/i;
const RESULT = /\d|\b(result|so that|which meant|in the end|ended up|saved|cut|reduced|increased|finished|won|improved|fewer|faster|on time|caught|fixed)\b/i;
const HONEST_GAP = /\b(haven't|have not|not yet|closest|learning|i'd start|i would start|i plan|i'm taking|i am taking|course|practic\w*)\b/i;

function words(text: string): string[] {
  return text.match(/[A-Za-z0-9$%+'.-]+/g)?.filter((w) => /[A-Za-z0-9]/.test(w)) ?? [];
}

function contentWords(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !["that", "with", "from", "this", "each", "their", "into", "them", "they", "were", "have"].includes(w)));
}

export function practiceFeedback(answer: string, question: Pick<PrepQuestion, "category" | "story" | "id">, factTexts: string[], company = ""): PracticeFeedback {
  const text = answer.trim();
  const count = words(text).length;
  const seconds = Math.round((count / WORDS_PER_MINUTE) * 60);
  const notes: PracticeNote[] = [];

  if (count < 25) {
    return { words: count, seconds, notes: [{ tone: "fix", text: "Say a bit more before checking it. A full answer takes at least half a minute out loud." }] };
  }

  const [low, high] = TARGET[question.category];
  if (seconds < low * 0.75) notes.push({ tone: "fix", text: `About ${seconds} seconds. That's short for this question; aim for ${low} to ${high}.` });
  else if (seconds > high * 1.2) notes.push({ tone: "fix", text: `About ${seconds} seconds. Trim it to under ${high}: lead with the result, then how you got there.` });
  else notes.push({ tone: "good", text: `About ${seconds} seconds, a good length for this question.` });

  if (question.category === "skill" || question.category === "behavioral") {
    const hasSituation = SITUATION.test(text);
    const hasResult = RESULT.test(text);
    if (!hasSituation) notes.push({ tone: "fix", text: "Open with the situation in one sentence: where you were and what needed doing." });
    if (!hasResult) notes.push({ tone: "fix", text: "End with the result: what changed because of you. If you don't have a number, describe the difference plainly." });
    if (hasSituation && hasResult) notes.push({ tone: "good", text: "It has the situation, what you did, and how it turned out." });
  }

  const mine = text.match(/\bI\b/g)?.length ?? 0;
  const ours = text.match(/\bwe\b/gi)?.length ?? 0;
  if (ours >= 2 && ours > mine) notes.push({ tone: "fix", text: `You said "we" ${ours} times and "I" ${mine}. Make your own part clear.` });

  const confirmed = new Set(factTexts.flatMap((f) => claimNumbers(f).map((n) => n.value)));
  const said = claimNumbers(text);
  const unbacked = [...new Set(said.filter((n) => !confirmed.has(n.value) && !confirmed.has(n.value.replace(/%$/, ""))).map((n) => n.token))];
  if (unbacked.length) {
    notes.push({ tone: "fix", text: `You said ${unbacked.map((t) => `"${t}"`).join(", ")}, which isn't in your confirmed facts. Make sure you can back it up, or add it on My facts.` });
  } else if (said.length) {
    notes.push({ tone: "good", text: "Every number you said matches your confirmed facts." });
  }

  if (question.story) {
    const story = question.story;
    const shared = [...contentWords(story.text)].filter((w) => contentWords(text).has(w)).length;
    const namesOrg = story.org ? text.toLowerCase().includes(story.org.toLowerCase()) : false;
    if (namesOrg || shared >= 3) notes.push({ tone: "good", text: `You used your ${story.org ?? "strongest"} example.` });
    else notes.push({ tone: "fix", text: `Your strongest example for this is${story.org ? ` from ${story.org}` : ""}: "${story.text.trim().replace(/[.;,\s]+$/, "")}." Consider telling that one.` });
  }

  if (question.category === "gap") {
    if (HONEST_GAP.test(text)) notes.push({ tone: "good", text: "Honest about the gap, with a plan. That's the right way to answer this." });
    else notes.push({ tone: "fix", text: "Say plainly what you haven't done yet, name the closest thing you have done, and how you'd get up to speed." });
  }

  if (question.id === "why-company" && company && !text.toLowerCase().includes(company.toLowerCase())) {
    notes.push({ tone: "fix", text: `Say ${company} by name, with one specific reason you want to work there.` });
  }

  const cliches = [...new Set(findVoiceIssues(text).filter((i) => i.rule === "banned-phrase").map((i) => i.match.toLowerCase()))];
  if (cliches.length) notes.push({ tone: "fix", text: `${cliches.map((c) => `"${c}"`).join(", ")}: interviewers hear this all day. Show it with an example instead.` });

  return { words: count, seconds, notes: [...notes.filter((n) => n.tone === "fix"), ...notes.filter((n) => n.tone === "good")] };
}
