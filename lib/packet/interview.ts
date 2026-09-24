import { formatMonth } from "@/lib/resume/parse/dates";
import { inSentence, roleWithNoun } from "./cover-letter";
import type { Evidence } from "./evidence";

/**
 * Interview prep from a person's own evidence. For each likely question it
 * suggests the story they already have, split into the parts an interviewer
 * listens for, and names what's missing instead of filling it in.
 */

export type QuestionCategory = "intro" | "motivation" | "skill" | "behavioral" | "gap";

export type StoryParts = {
  /** What was going on. Only the person knows; always their words. */
  situation: string | null;
  action: string;
  result: string | null;
};

export type PrepQuestion = {
  id: string;
  category: QuestionCategory;
  question: string;
  /** Why an interviewer asks it, in one line. */
  why: string;
  story: { evidenceId: string; org: string | null; text: string; parts: StoryParts } | null;
  /** What to say or add, specific to this person. */
  tips: string[];
};

export type PrepContext = {
  company: string;
  title: string;
  school: string | null;
  major: string | null;
  gradDate: string | null;
  evidence: Evidence[];
  /** Posting skills the person has shown. */
  matched: string[];
  /** Required skills with no confirmed evidence. */
  missing: string[];
  experiences: Array<{ org: string; title: string | null }>;
};

const RESULT_TAIL = /,\s+((?:catching|cutting|saving|reducing|raising|increasing|growing|improving|helping|bringing|earning|winning|finishing|placing|avoiding|preventing|recovering|freeing|lifting|keeping)\b.+)$/i;

/** "Cut counts from 2 days to 6 hours by building a tracker" -> result first, then how. */
export function storyParts(text: string): StoryParts {
  const clean = text.trim().replace(/[.;\s]+$/, "");
  const by = clean.match(/^(.+?)\s+by\s+(.+)$/i);
  if (by && /\d|\b(fewer|faster|less|more|zero|none|no)\b/i.test(by[1])) {
    return { situation: null, action: by[2][0].toUpperCase() + by[2].slice(1), result: by[1] };
  }
  const tail = clean.match(RESULT_TAIL);
  if (tail) {
    const action = clean.slice(0, tail.index).trim();
    return { situation: null, action, result: tail[1][0].toUpperCase() + tail[1].slice(1) };
  }
  const outcome = clean.match(/^(.+?),\s+(with\s+.+)$/i);
  if (outcome) return { situation: null, action: outcome[1], result: outcome[2][0].toUpperCase() + outcome[2].slice(1) };
  return { situation: null, action: clean, result: /\d/.test(clean) ? clean : null };
}

type Theme = { id: string; question: string; why: string; pattern: RegExp };

/** The behaviors employers screen entry-level candidates for most (NACE Job Outlook). */
const THEMES: Theme[] = [
  {
    id: "teamwork",
    question: "Tell me about a time you worked on a team to get something done.",
    why: "Teamwork is the skill employers rank highest for new hires.",
    pattern: /\b(team|group|together|collaborat\w*|committee|members?|partner(ed)?|club|chapter)\b/i,
  },
  {
    id: "problem",
    question: "Describe a problem you noticed and how you solved it.",
    why: "They want to see you find problems on your own, not just follow instructions.",
    pattern: /\b(fix\w*|solv\w*|caught|found|reduc\w*|cut|automat\w*|streamlin\w*|improv\w*|built|duplicate|errors?|mistakes?)\b/i,
  },
  {
    id: "initiative",
    question: "Tell me about something you started or improved without being asked.",
    why: "Initiative separates candidates with similar resumes.",
    pattern: /\b(built|created|started|founded|launched|designed|proposed|introduced|set up|organized)\b/i,
  },
  {
    id: "pressure",
    question: "Tell me about a time you had a tight deadline or a heavy workload.",
    why: "Busy seasons are part of most entry-level roles.",
    pattern: /\b(deadline|season|rush|each (week|month)|every (week|month)|per (week|month)|a (week|month)|month[- ]end|on time|weekly|hours?)\b/i,
  },
  {
    id: "communication",
    question: "Give an example of explaining something to someone who didn't know the details.",
    why: "Clear communication is on almost every entry-level posting.",
    pattern: /\b(present\w*|explain\w*|taught|tutor\w*|train\w*|clients?|customers?|patients?|report\w*|wrote|writing)\b/i,
  },
  {
    id: "leadership",
    question: "Tell me about a time you led people or took charge of something.",
    why: "Leadership shows up in clubs and part-time jobs, not just titles.",
    pattern: /\b(led|lead|managed|supervis\w*|mentor\w*|president|captain|chair\w*|coordinat\w*|organized)\b/i,
  },
];

function toStory(e: Evidence) {
  return { evidenceId: e.id, org: e.org, text: e.text, parts: storyParts(e.text) };
}

function storyTips(e: Evidence, extra: string[] = []): string[] {
  const parts = storyParts(e.text);
  const tips = [`Set the scene in a sentence: what was going on at ${e.org ?? "the time"} and why it mattered.`];
  if (!parts.result) tips.push("End with what changed because of you. If you don't know a number, describe the difference plainly.");
  tips.push("Say \"I\" for your part. Interviewers want to know what you did, not the team.");
  return [...extra, ...tips];
}

/** Likely questions for this posting, most important first, each with the best story this person has. */
export function interviewPrep(ctx: PrepContext): PrepQuestion[] {
  const questions: PrepQuestion[] = [];
  const used = new Set<string>();
  const pick = (candidates: Evidence[]) => {
    const fresh = candidates.find((e) => !used.has(e.id)) ?? candidates[0];
    if (fresh) used.add(fresh.id);
    return fresh ?? null;
  };

  // Walk me through your background
  const recent = ctx.experiences.slice(0, 2).map((e) => (e.title ? `${e.title} at ${e.org}` : e.org));
  const present = ctx.school ? `${ctx.major ? `${ctx.major} student` : "Student"} at ${ctx.school}${ctx.gradDate ? `, graduating ${formatMonth(ctx.gradDate)}` : ""}` : null;
  questions.push({
    id: "intro",
    category: "intro",
    question: "Tell me about yourself.",
    why: "Almost every interview opens here. Keep it to about a minute.",
    story: null,
    tips: [
      present ? `Now: ${present}.` : "Now: what you're studying or doing today.",
      recent.length ? `Before: ${recent.join("; then ")}. Pick one result from each.` : "Before: one or two experiences that led you here.",
      `Next: why the ${roleWithNoun(ctx.title)} is the logical next step.`,
    ],
  });

  questions.push({
    id: "why-company",
    category: "motivation",
    question: `Why ${ctx.company}, and why this role?`,
    why: "They're checking that you chose them on purpose.",
    story: null,
    tips: [
      `Name one specific thing about ${ctx.company}: a product, a client, a team, or someone you spoke with.`,
      ctx.matched.length ? `Connect it to what you've done: your work with ${ctx.matched.slice(0, 2).map(inSentence).join(" and ")}.` : "Connect it to something you've done or want to learn.",
    ],
  });

  // One question per matched required skill, backed by the story that shows it
  for (const skill of ctx.matched.slice(0, 3)) {
    const e = pick(ctx.evidence.filter((x) => x.covers.includes(skill)));
    questions.push({
      id: `skill-${skill.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      category: "skill",
      question: `Walk me through a time you used ${inSentence(skill)}.`,
      why: "The posting asks for it, so expect a follow-up on how you actually did the work.",
      story: e ? toStory(e) : null,
      tips: e
        ? storyTips(e, ["Be ready to explain the steps, the tools, and how you checked your work."])
        : [`Your profile lists ${inSentence(skill)}, but no story shows it in action yet. Add one to your profile so you have an example ready.`],
    });
  }

  for (const theme of THEMES) {
    const e = pick(ctx.evidence.filter((x) => theme.pattern.test(x.text)));
    if (!e) continue;
    questions.push({
      id: theme.id,
      category: "behavioral",
      question: theme.question,
      why: theme.why,
      story: toStory(e),
      tips: storyTips(e),
    });
    if (questions.filter((q) => q.category === "behavioral").length >= 4) break;
  }

  for (const skill of ctx.missing.slice(0, 2)) {
    questions.push({
      id: `gap-${skill.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      category: "gap",
      question: `This role uses ${inSentence(skill)}. What's your experience with it?`,
      why: "Your profile doesn't show it yet, so plan an honest answer.",
      story: null,
      tips: [
        "Don't stretch the truth. Say what you have done that's closest, then how you'd close the gap.",
        `If you have used ${inSentence(skill)}, add an example to your profile so it counts toward your fit.`,
      ],
    });
  }

  questions.push({
    id: "questions-for-them",
    category: "motivation",
    question: "What questions do you have for us?",
    why: "Having none reads as low interest.",
    story: null,
    tips: [
      "What does a strong first three months look like in this role?",
      `How does the ${roleWithNoun(ctx.title)} work with the rest of the team day to day?`,
      "What's something the last person in this role learned quickly that helped them?",
    ],
  });

  return questions;
}
