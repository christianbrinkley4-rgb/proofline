/**
 * Cleans up dictation the way a person would if they typed it: drops filler
 * ("um", "you know"), repeated words, and false starts, applies spoken
 * corrections ("30, I mean 40"), and punctuates. It only removes; it never adds
 * a word or a number the speaker didn't say.
 */

const FILLER = [
  /\b(?:um+|uh+m*|erm+|er|ah+|hmm+|mm+)\b[,.]?/gi,
  /(?:^|,\s*|\s)(?:you know|i guess|kind of like|sort of like)(?:,\s*|\s|$)/gi,
  /(?:^|,\s*)like,\s*/gi,
  /(?:^|\s)(?:basically|literally|honestly),?\s+/gi,
];

/** "30, I mean 40" -> "40"; "on Tuesday, sorry, Wednesday" keeps the correction marker out. */
const NUMBER_CORRECTION = /(\$?\d[\d,.]*\+?%?)\s*,?\s*(?:i mean|no wait|wait no|sorry|actually|or rather|make that|no)\s*,?\s*(\$?\d[\d,.]*\+?%?)/gi;
const CORRECTION_MARKER = /\s*,?\s*\b(?:no wait|wait no|or rather|i mean)\b\s*,?\s*/gi;
const SCRATCH = /[^.!?]*\b(?:scratch that|strike that|never mind that)\b[.!?,]?\s*/gi;

function tidySentence(raw: string): string {
  let s = raw.trim();
  s = s.replace(NUMBER_CORRECTION, "$2");
  for (const f of FILLER) s = s.replace(f, " ");
  s = s.replace(CORRECTION_MARKER, " ");
  // "the the", "I I": the same word twice in a row, ignoring case.
  s = s.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
  s = s.replace(/\s+([,.!?;:])/g, "$1").replace(/([,;:])(?=\S)/g, "$1 ").replace(/,\s*,/g, ",");
  s = s.replace(/^[\s,;:.-]+/, "").replace(/[\s,;:-]+$/, "").replace(/\s{2,}/g, " ");
  s = s.replace(/\bi\b/g, "I").replace(/\bi'(m|ve|d|ll)\b/gi, (_m, t: string) => `I'${t.toLowerCase()}`);
  if (!s) return "";
  s = s[0].toUpperCase() + s.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

/**
 * Dictation arrives as segments, one per pause. Each becomes a sentence;
 * "new paragraph" and "new line" break the text where the speaker asked.
 */
export function cleanTranscript(segments: string[] | string): string {
  const joined = (Array.isArray(segments) ? segments : [segments])
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" \u0000 ")
    .replace(SCRATCH, "");
  return joined
    .split(/\s*\bnew paragraph\b\s*/i)
    .map((paragraph) =>
      paragraph
        .split(/\s*\bnew line\b\s*/i)
        .map((line) =>
          line
            .split(/\u0000|(?<=[.!?])\s+/)
            .map(tidySentence)
            .filter(Boolean)
            .join(" "),
        )
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");
}

/** Numbers a cleaned version must not invent, for checking a model's cleanup against the raw words. */
export function introducesNumbers(raw: string, cleaned: string): string[] {
  const nums = (t: string) => new Set((t.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, "").replace(/,/g, "")));
  const before = nums(raw);
  return [...nums(cleaned)].filter((n) => !before.has(n));
}

/** Best guesses from how people talk about a job: "at Oakwood Family Dental", "as a bookkeeping assistant". */
export function guessDetails(text: string): { org: string | null; title: string | null; kind: "work" | "internship" | "leadership" | "project" | "volunteer" | "research" } {
  const org = text.match(/\b(?:at|for|with)\s+((?:the\s+)?(?:[A-Z][\w&'.-]*)(?:\s+(?:of|and|&)?\s*[A-Z][\w&'.-]*){0,5})/)?.[1]?.replace(/^the\s+/i, "").trim() ?? null;
  const title = text.match(/\bas (?:a|an|the)\s+([a-z][a-z -]{2,40}?)(?=[,.]|\s+(?:at|for|with|where|and|in)\b|$)/i)?.[1]?.trim() ?? null;
  const t = text.toLowerCase();
  const kind = /\bintern(ship)?\b/.test(t)
    ? "internship"
    : /\bvolunteer/.test(t)
      ? "volunteer"
      : /\b(research|lab|professor|study)\b/.test(t)
        ? "research"
        : /\b(club|president|treasurer|captain|chapter|society|organization|team lead)\b/.test(t)
          ? "leadership"
          : /\b(project|built|app|website|hackathon|class project)\b/.test(t) && !/\b(job|shift|manager|customers?)\b/.test(t)
            ? "project"
            : "work";
  return { org, title: title ? title.replace(/\b\w/g, (c) => c.toUpperCase()) : null, kind };
}
