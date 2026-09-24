import { z } from "zod";
import { findVoiceIssues } from "@/lib/voice/rules";
import { verifyBullet } from "@/lib/resume/verify";
import { formatMonth } from "@/lib/resume/parse/dates";
import { skillCategory } from "@/lib/fit/skills";
import { roleName } from "@/lib/jobs/text";
import { asSentence, type Evidence } from "./evidence";

/**
 * A cover letter built only from confirmed evidence. Every paragraph lists the
 * sources it rests on, so the person can see why each sentence is there. Proofline
 * never guesses why someone wants a job: without their reason, the letter keeps a
 * bracketed prompt that the export check refuses to ship.
 */

export const LetterParagraphSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  /** Evidence ids this paragraph uses. Empty for the opening and closing. */
  sourceIds: z.array(z.string()).max(12),
  purpose: z.enum(["opening", "evidence", "fit", "motivation", "closing"]),
});
export type LetterParagraph = z.infer<typeof LetterParagraphSchema>;

export const CoverLetterSchema = z.object({
  greeting: z.string().trim().min(1).max(200),
  paragraphs: z.array(LetterParagraphSchema).min(1).max(8),
  signoff: z.string().trim().min(1).max(100),
  generator: z.enum(["offline", "anthropic", "user"]),
  promptVersion: z.string().nullable(),
});
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

export type LetterContext = {
  name: string;
  school: string | null;
  degree: string | null;
  major: string | null;
  gradDate: string | null;
  company: string;
  title: string;
  /** Hiring contact from the tracker, when the person added one. */
  contactName?: string | null;
  /** The person's own reason for wanting this job, in their words. */
  why?: string | null;
  /** Ranked, most relevant first. */
  evidence: Evidence[];
  now?: Date;
};

export const WHY_PLACEHOLDER = (company: string) =>
  `[Add one or two sentences, in your own words, on why ${company} and this role. Name something real: a product you use, a team, a person you met, or work they do that you care about.]`;

const PLACEHOLDER = /\[[^\]]{8,}\]/;

function studentLine(ctx: LetterContext): string | null {
  if (!ctx.school) return null;
  const field = ctx.major ? `${ctx.major} ` : "";
  const grad = ctx.gradDate ? new Date(`${ctx.gradDate.length === 4 ? `${ctx.gradDate}-05` : ctx.gradDate}-01T00:00:00Z`) : null;
  const future = grad ? grad.getTime() > (ctx.now ?? new Date()).getTime() : true;
  if (future) {
    const article = /^[aeiou]/i.test(field || "student") ? "an" : "a";
    return `I'm ${article} ${field}student at ${ctx.school}${grad ? `, graduating in ${formatMonth(ctx.gradDate)}` : ""}.`;
  }
  const degree = [ctx.degree, ctx.major ? `in ${ctx.major}` : null].filter(Boolean).join(" ");
  return `I graduated from ${ctx.school}${degree ? ` with a ${degree}` : ""} in ${formatMonth(ctx.gradDate)}.`;
}

/** "Accounting Intern role", but "Financial Accounting Internship" on its own. */
export function roleWithNoun(title: string): string {
  const name = roleName(title);
  return /\b(internship|program|fellowship|co-?op|rotation|role|position)$/i.test(name) ? name : `${name} role`;
}

function listPhrase(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** "Account reconciliation" reads as "account reconciliation" mid-sentence; "Excel" and "GAAP" stay. */
export function inSentence(skill: string): string {
  const words = skill.split(" ");
  const common = words.length > 1 ? words.slice(1).every((w) => w === w.toLowerCase()) : ["accounting", "finance", "business", "soft"].includes(skillCategory(skill) ?? "");
  return common && /^[A-Z][a-z]/.test(skill) ? skill[0].toLowerCase() + skill.slice(1) : skill;
}

function ownWords(why: string): string {
  const clean = why.trim().replace(/\s+/g, " ");
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

/** Rules-only draft. Picks the strongest evidence for the posting and says only what it shows. */
export function draftCoverLetterOffline(ctx: LetterContext): CoverLetter {
  const paragraphs: LetterParagraph[] = [];
  const opening = [`I'm applying for the ${roleWithNoun(ctx.title)} at ${ctx.company}.`, studentLine(ctx)].filter(Boolean).join(" ");
  paragraphs.push({ text: opening, sourceIds: [], purpose: "opening" });

  // Up to three pieces, no more than two from one place, so the letter shows range.
  const picked: Evidence[] = [];
  const perOrg = new Map<string, number>();
  for (const e of ctx.evidence) {
    const key = e.experienceId ?? e.id;
    if ((perOrg.get(key) ?? 0) >= 2) continue;
    picked.push(e);
    perOrg.set(key, (perOrg.get(key) ?? 0) + 1);
    if (picked.length === 3) break;
  }

  if (picked.length) {
    const [first, ...rest] = picked;
    const sameOrg = rest.filter((e) => e.experienceId && e.experienceId === first.experienceId);
    const other = rest.filter((e) => !sameOrg.includes(e));
    const lead = [first, ...sameOrg];
    const leadText = lead.map((e, i) => asSentence(e.text, { org: e.org, lead: i === 0 ? "at" : "also" })).join(" ");
    paragraphs.push({ text: leadText, sourceIds: lead.map((e) => e.id), purpose: "evidence" });
    if (other.length) {
      const seen = new Set<string>();
      const otherText = other
        .map((e) => {
          const key = e.experienceId ?? e.id;
          const lead = seen.has(key) ? "also" : "at";
          seen.add(key);
          return asSentence(e.text, { org: e.org, lead });
        })
        .join(" ");
      paragraphs.push({ text: otherText, sourceIds: other.map((e) => e.id), purpose: "evidence" });
    }
  }

  const shown = [...new Set(picked.flatMap((e) => e.covers))].slice(0, 3);
  if (shown.length) {
    paragraphs.push({
      text: `That work gave me hands-on practice with ${listPhrase(shown.map(inSentence))}, which your posting asks for.`,
      sourceIds: picked.filter((e) => e.covers.some((c) => shown.includes(c))).map((e) => e.id),
      purpose: "fit",
    });
  }

  paragraphs.push({ text: ctx.why?.trim() ? ownWords(ctx.why) : WHY_PLACEHOLDER(ctx.company), sourceIds: [], purpose: "motivation" });
  paragraphs.push({
    text: `I'd welcome the chance to talk about how I could contribute to ${ctx.company}. Thank you for your time and consideration.`,
    sourceIds: [],
    purpose: "closing",
  });

  return {
    greeting: ctx.contactName?.trim() ? `Dear ${ctx.contactName.trim()},` : "Dear Hiring Team,",
    paragraphs,
    signoff: "Sincerely,",
    generator: "offline",
    promptVersion: null,
  };
}

export type LetterCheck = { id: string; ok: boolean; label: string; detail: string; blocking: boolean };

/** Where a letter stands for the coach: not drafted, waiting on the person's own words, or ready to review. */
export type LetterStatus = "none" | "needs_you" | "ready";

export function letterStatus(letter: CoverLetter | null | undefined): LetterStatus {
  if (!letter) return "none";
  return letter.paragraphs.some((p) => PLACEHOLDER.test(p.text)) ? "needs_you" : "ready";
}

/**
 * What must be true before a letter leaves Proofline. A paragraph a model wrote
 * may only use numbers found in the facts it cites; the person's own edits are
 * theirs to stand behind, so they are only held to the voice rules.
 */
export function checkCoverLetter(letter: CoverLetter, factTextById: Map<string, string>, evidenceById: Map<string, { factIds: string[] }>): LetterCheck[] {
  const checks: LetterCheck[] = [];
  const all = [letter.greeting, ...letter.paragraphs.map((p) => p.text), letter.signoff].join("\n");

  const placeholder = letter.paragraphs.some((p) => PLACEHOLDER.test(p.text));
  checks.push({
    id: "placeholder",
    ok: !placeholder,
    blocking: true,
    label: "No unfilled prompts",
    detail: placeholder ? "Replace the bracketed prompt with your own words first." : "Every part is filled in.",
  });

  const unsupported: string[] = [];
  let stale = false;
  if (letter.generator !== "user") {
    for (const p of letter.paragraphs) {
      if (!p.sourceIds.length) continue;
      const factIds = p.sourceIds.flatMap((id) => evidenceById.get(id)?.factIds ?? []);
      const texts = factIds.map((id) => factTextById.get(id)).filter((t): t is string => Boolean(t));
      if (texts.length < factIds.length || factIds.length === 0) stale = true;
      unsupported.push(...verifyBullet(p.text, texts).unsupported);
    }
  }
  checks.push({
    id: "evidence",
    ok: !stale && unsupported.length === 0,
    blocking: true,
    label: "Every claim traces to a confirmed fact",
    detail: stale
      ? "A fact this letter used changed or is no longer confirmed. Redraft the letter."
      : unsupported.length
        ? `These numbers aren't in the facts they cite: ${[...new Set(unsupported)].join(", ")}.`
        : letter.generator === "user"
          ? "You edited this letter, so it's in your words. Read it once more before you send it."
          : "Each number appears in a confirmed fact.",
  });

  const voice = findVoiceIssues(all);
  checks.push({
    id: "voice",
    ok: voice.length === 0,
    blocking: false,
    label: "Sounds like a person",
    detail: voice.length ? `Consider rewording: ${[...new Set(voice.map((v) => (v.rule === "em-dash" ? "em dash" : v.match)))].join(", ")}.` : "No filler words or em dashes.",
  });

  const words = all.split(/\s+/).filter(Boolean).length;
  checks.push({
    id: "length",
    ok: words >= 120 && words <= 400,
    blocking: false,
    label: "Readable length",
    detail: words < 120 ? `${words} words. Most strong letters run 200 to 350.` : words > 400 ? `${words} words. Cut toward 350 so it gets read.` : `${words} words.`,
  });
  return checks;
}

/** Plain text for copying into an application form. */
export function letterText(letter: CoverLetter, signature: string): string {
  return [letter.greeting, "", ...letter.paragraphs.flatMap((p) => [p.text, ""]), letter.signoff, signature].join("\n");
}
