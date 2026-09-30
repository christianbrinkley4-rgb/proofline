import { z } from "zod";
import { extractSkills } from "@/lib/fit/skills";
import { verifyBullet } from "@/lib/resume/verify";
import { asSentence, type Evidence } from "./evidence";
import { inSentence } from "./cover-letter";

/**
 * Drafts for the short-answer questions on application forms, from confirmed
 * evidence. Like the cover letter, it never supplies motivation or context only
 * the person knows; those parts stay as bracketed prompts for them to fill.
 */

export const AnswerSchema = z.object({
  id: z.string(),
  question: z.string().trim().min(5).max(1000),
  answer: z.string().max(6000),
  sourceIds: z.array(z.string()).max(12),
  kind: z.enum(["motivation", "behavioral", "skill", "general"]),
  wordLimit: z.number().int().min(20).max(1000).nullable(),
  generator: z.enum(["offline", "anthropic", "user"]),
  updatedAt: z.string(),
});
export type ApplicationAnswer = z.infer<typeof AnswerSchema>;

export type AnswerContext = {
  company: string;
  role: string;
  why: string | null;
  evidence: Evidence[];
};

const STOP = new Set(
  "a an the and or of to in on for with at by from as is are was were be been your you our we us it this that these those what how why when where which who whom describe tell share give example time times about please explain would could should do did does have has had".split(" "),
);

export function questionKind(question: string): ApplicationAnswer["kind"] {
  const q = question.toLowerCase();
  if (/\bwhy\b[^?]*\b(interest|want|join|apply|applying|choose|us|company|role|position|here)\b|\bwhat (draws|attracts|excites|interests) you\b|\bmotivat/.test(q)) return "motivation";
  if (/\b(describe|tell us about|tell me about|share|give an example of|walk us through)\b[^?]*\b(time|situation|challenge|example|project|mistake|failure|conflict|problem)\b/.test(q)) return "behavioral";
  if (/\b(experience with|proficien|familiar(ity)? with|skills? in|how have you used)\b/.test(q) || extractSkills(q).length > 0) return "skill";
  return "general";
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

/** Evidence ranked for one question: shared words and skills first, then its overall rank. */
export function evidenceFor(question: string, evidence: Evidence[]): Evidence[] {
  const qWords = words(question);
  const qSkills = new Set(extractSkills(question));
  return evidence
    .map((e, rank) => {
      const eWords = words(e.text);
      const overlap = [...qWords].filter((w) => eWords.has(w)).length;
      const skills = extractSkills(e.text).filter((s) => qSkills.has(s)).length;
      return { e, score: skills * 3 + overlap - rank * 0.05 };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}

function limit(text: string, wordLimit: number | null): string {
  if (!wordLimit) return text;
  const parts = text.split(/(?<=[.!?\]])\s+/);
  let out = "";
  for (const p of parts) {
    const next = out ? `${out} ${p}` : p;
    if (next.split(/\s+/).length > wordLimit && out) break;
    out = next;
  }
  return out;
}

/** Rules-only draft. */
export function draftAnswerOffline(question: string, ctx: AnswerContext, wordLimit: number | null = null): Omit<ApplicationAnswer, "id" | "updatedAt"> {
  const kind = questionKind(question);
  const ranked = evidenceFor(question, ctx.evidence);
  const pick = (n: number) => {
    const out: Evidence[] = [];
    for (const e of ranked) {
      if (out.some((o) => o.experienceId && o.experienceId === e.experienceId)) continue;
      out.push(e);
      if (out.length === n) break;
    }
    return out;
  };
  let answer: string;
  let sources: Evidence[] = [];

  if (kind === "motivation") {
    sources = pick(1);
    const reason = ctx.why?.trim()
      ? ctx.why.trim().replace(/([^.!?])$/, "$1.")
      : `[In your own words: what about ${ctx.company} and this ${ctx.role} role made you apply? Name something specific.]`;
    const link = sources[0]
      ? ` ${asSentence(sources[0].text, { org: sources[0].org, lead: "at" })} ${sources[0].covers.length ? `That's the kind of ${inSentence(sources[0].covers[0])} work I want to keep doing here.` : "I'd like to build on that here."}`
      : "";
    answer = `${reason}${link}`;
  } else if (kind === "behavioral") {
    sources = pick(1);
    const s = sources[0];
    answer = s
      ? `[Set the scene in a sentence: what was going on at ${s.org ?? "the time"}, and what needed to change?] ${asSentence(s.text, { org: s.org, lead: "at" })} [Close with what you learned or would do the same way again.]`
      : "[Pick a real example from your experience. Proofline didn't find confirmed evidence that matches this question yet; add it to your profile first.]";
  } else if (kind === "skill") {
    const skills = [...new Set(extractSkills(question))];
    // Only lines that show the skill asked about; another skill's line doesn't answer the question.
    const asked = new Set(skills);
    sources = asked.size ? pick(ranked.length).filter((e) => extractSkills(e.text).some((s) => asked.has(s))).slice(0, 2) : pick(2);
    answer = sources.length
      ? `${sources.map((e) => asSentence(e.text, { org: e.org, lead: "at" })).join(" ")}${skills.length ? ` Those are the places I've used ${skills.map(inSentence).join(" and ")} the most.` : ""}`
      : `[Be honest about your level with ${skills.map(inSentence).join(" and ") || "this"}. Proofline doesn't have confirmed evidence of it yet; say what you've done that's closest and how you'd get up to speed.]`;
  } else {
    sources = pick(2);
    answer = sources.length
      ? `${sources.map((e) => asSentence(e.text, { org: e.org, lead: "at" })).join(" ")} [Tie this back to the question in a sentence of your own.]`
      : "[Answer in your own words. Proofline didn't find confirmed evidence that fits this question yet.]";
  }
  return { question: question.trim(), answer: limit(answer, wordLimit), sourceIds: sources.map((e) => e.id), kind, wordLimit, generator: "offline" };
}

/** A model-written answer passes only if every number appears in the facts behind its cited evidence. */
export function answerSupported(answer: string, sourceIds: string[], evidenceById: Map<string, Evidence>, factText: Map<string, string>): boolean {
  const facts = sourceIds.flatMap((id) => evidenceById.get(id)?.factIds ?? []).map((id) => factText.get(id)).filter((t): t is string => Boolean(t));
  if (!sourceIds.length) return !/\d/.test(answer.replace(/\b(19|20)\d{2}\b/g, ""));
  return verifyBullet(answer, facts).ok;
}

export const PLACEHOLDER = /\[[^\]]{8,}\]/;
