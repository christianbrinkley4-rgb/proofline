import type { FactCategory } from "@/lib/kb/facts";
import type { QuestionInput } from "@/lib/kb/questions";

/**
 * Follow-up questions for an experience, rules only. Finds claims that would be
 * stronger with a number and asks for it, instead of inventing one.
 *
 * "You mentioned leading a team. How many people?"
 */

export type ProbeContext = { org: string; title?: string | null; notes: string };

type Probe = {
  id: string;
  test: RegExp;
  /** Skip when the same sentence already has a number. */
  needsNumber: boolean;
  build: (match: RegExpMatchArray, ctx: ProbeContext) => Omit<QuestionInput, "experienceId">;
};

const VOLUME_NOUNS =
  "accounts|invoices|returns|clients|customers|patients|members|students|orders|transactions|calls|tickets|events|attendees|posts|reports|skus|items|products|applications|cases|reconciliations|entries|statements|shipments|guests|residents|kids|campers|tutees|volunteers|donors|leads";

const PER_PERIOD = /\b(a|per|each|every)\s+(day|week|month|semester|shift|quarter|year)\b/i;
const HAS_NUMBER = /\d/;

function at(ctx: ProbeContext) {
  return ctx.org ? ` (${ctx.org})` : "";
}

const PROBES: Probe[] = [
  {
    id: "team-size",
    test: /\b(led|lead|managed|supervised|trained|mentored|coordinated|ran)\b[^.]*\b(team|group|staff|crew|committee|volunteers|members|interns)\b/i,
    needsNumber: true,
    build: (_m, ctx) => ({
      prompt: "You mentioned leading people. How many were on the team?",
      kind: "number",
      factTemplate: `Led a team of {answer} people${at(ctx)}`,
      factCategory: "leadership" satisfies FactCategory,
      priority: 9,
    }),
  },
  {
    id: "volume",
    test: new RegExp(`\\b(${VOLUME_NOUNS})\\b`, "i"),
    needsNumber: true,
    build: (m, ctx) => {
      const noun = m[1].toLowerCase();
      return {
        prompt: `About how many ${noun} did you handle, and how often? For example "40 a month".`,
        kind: "text",
        factTemplate: `Handled about {answer} ${noun}${at(ctx)}`,
        factCategory: "metric" satisfies FactCategory,
        priority: 8,
      };
    },
  },
  {
    id: "improvement",
    test: /\b(saved|save|reduced|cut|faster|improved|increased|grew|boosted|raised|streamlined|automated|fixed|simplified|sped up|caught|prevented)\b/i,
    needsNumber: true,
    build: (m, ctx) => ({
      prompt: `You said you ${m[1].toLowerCase()} something. What changed because of it? A rough number helps: hours saved, dollars, or a percent.`,
      kind: "text",
      factTemplate: `Result: {answer}${at(ctx)}`,
      factCategory: "metric" satisfies FactCategory,
      priority: 10,
    }),
  },
  {
    id: "money",
    test: /\b(budget|revenue|sales|fundrais\w*|donations?|raised|sold|payments?)\b/i,
    needsNumber: true,
    build: (_m, ctx) => ({
      prompt: "About how much money was involved? A range is fine.",
      kind: "text",
      factTemplate: `About {answer} involved${at(ctx)}`,
      factCategory: "metric" satisfies FactCategory,
      priority: 7,
    }),
  },
];

const TOOL_WORDS =
  /\b(excel|sheets|quickbooks|sql|python|tableau|power ?bi|salesforce|sap|oracle|netsuite|workday|r\b|java|javascript|typescript|figma|canva|hubspot|jira|notion|word|powerpoint|outlook|taxslayer|lacerte|cch|ultratax|alteryx|bloomberg|capital iq|factset)\b/i;

/** Up to `limit` questions, most useful first, never asking for a number the user already gave. */
export function probeExperience(ctx: ProbeContext, limit?: number): Array<Omit<QuestionInput, "experienceId">> {
  const sentences = ctx.notes
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const found = new Map<string, Omit<QuestionInput, "experienceId">>();
  for (const sentence of sentences) {
    for (const probe of PROBES) {
      if (found.has(probe.id)) continue;
      const match = sentence.match(probe.test);
      if (!match) continue;
      if (probe.needsNumber && HAS_NUMBER.test(sentence) && (probe.id !== "volume" || PER_PERIOD.test(sentence))) continue;
      found.set(probe.id, probe.build(match, ctx));
    }
  }

  // A bare activity such as "prepared tax returns" needs X/Y/Z evidence:
  // what the person did, how much and how often, with what method, and what changed.
  const taxWork = /\b(prepared?|preparing|filed|reviewed|processed)\b[^.!?\n]{0,100}\btax returns?\b|\btax returns?\b[^.!?\n]{0,100}\b(prepared?|preparing|filed|reviewed|processed)\b/i.test(ctx.notes);
  if (taxWork) {
    found.delete("volume");
    found.delete("improvement");
    const tax: Array<Omit<QuestionInput, "experienceId">> = [];
    if (!/\b\d[\d,]*\s*(?:individual |business |corporate )?(?:tax )?returns?\b/i.test(ctx.notes)) tax.push({
      prompt: "About how many tax returns did you prepare per week, month, or tax season? An estimate is fine; include the period.",
      kind: "text", factTemplate: "Tax returns prepared: {answer}" + at(ctx), factCategory: "metric", priority: 12,
    });
    if (!/\b(collected|reconciled|reviewed|checked|interviewed|filed|entered|calculated|researched)\b/i.test(ctx.notes)) tax.push({
      prompt: "Which parts did you personally handle, from gathering documents through review or filing?",
      kind: "text", factTemplate: "Personally handled {answer} during tax return preparation" + at(ctx), factCategory: "experience", priority: 11,
    });
    if (!TOOL_WORDS.test(ctx.notes)) tax.push({
      prompt: "Which tax software, spreadsheets, or other tools did you use? Skip if you did not use any.",
      kind: "text", factTemplate: "Tax preparation tools: {answer}" + at(ctx), factCategory: "tool", priority: 10,
    });
    if (!/\b(1040|1065|1120|individual|personal|business|corporate|partnership|nonprofit|state|federal)\b/i.test(ctx.notes)) tax.push({
      prompt: "What types of returns or clients did you work with? Only list the types you actually handled.",
      kind: "text", factTemplate: "Tax return types or clients: {answer}" + at(ctx), factCategory: "experience", priority: 9,
    });
    if (!/\b(reduced|cut|saved|faster|improved|fewer errors|accuracy)\b[^.!?\n]*\b\d/i.test(ctx.notes)) tax.push({
      prompt: "Did you improve efficiency or accuracy? If yes, what changed, and can you estimate the time saved, turnaround, or errors reduced? Skip if not.",
      kind: "text", factTemplate: "Tax preparation efficiency or accuracy improvement: {answer}" + at(ctx), factCategory: "metric", priority: 8,
    });
    if (!/\b(on.time|deadline|turnaround|client satisfaction|fewer corrections)\b/i.test(ctx.notes)) tax.push({
      prompt: "What did the work help achieve, such as on-time filings or fewer corrections? Share only an outcome you know; otherwise skip.",
      kind: "text", factTemplate: "Tax preparation outcome: {answer}" + at(ctx), factCategory: "metric", priority: 7,
    });
    return [...tax, ...found.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, limit ?? 6);
  }
  const questions = [...found.values()];

  if (!TOOL_WORDS.test(ctx.notes)) {
    questions.push({
      prompt: "What tools or software did you use there? List them with commas, or skip.",
      kind: "text",
      factTemplate: `Tools used${at(ctx)}: {answer}`,
      factCategory: "tool",
      priority: 4,
    });
  }

  if (!HAS_NUMBER.test(ctx.notes) && questions.length < 2) {
    questions.push({
      prompt: "What's one thing that was better because you were there? Anything counts: faster, fewer mistakes, happier customers.",
      kind: "text",
      factTemplate: `Impact${at(ctx)}: {answer}`,
      factCategory: "metric",
      priority: 6,
    });
  }

  return questions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, limit ?? 3);
}

/** Splits free-form notes into sentences the user stated, each a fact of its own. */
export function notesToStatements(notes: string): string[] {
  return notes
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-•*]\s*/, "").trim())
    .filter((s) => s.length > 3);
}
