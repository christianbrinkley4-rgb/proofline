import { toPastTense, toPresentTense } from "@/lib/resume/polish";

/**
 * Whether a line is verifiably in the confirmed facts, decided in code. A reviewer
 * that says a line has no support when a single confirmed fact already says the
 * same thing is wrong, and the gate sets that reviewer aside rather than looping
 * the person against it.
 *
 * The bar is deliberately strict. A resume line is a confirmed fact with its
 * opening verb put in the right tense (polishBullet changes nothing else), so every
 * word after the first must appear in one fact, and the first must be the same verb.
 * A line that swaps "helped" for "led" has a word the fact does not, and fails.
 */

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "at", "by", "from", "as", "is", "was", "were", "be", "been", "i", "my", "me", "we", "our",
  "also", "that", "this", "it", "its", "into", "over", "per", "each", "all", "using", "via", "than", "then", "so",
]);

/** A crude stem, applied the same way to both sides: "reconciled", "reconcile", and "reconciles" meet. */
function stem(word: string): string {
  let w = word;
  if (/\d/.test(w)) return w;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Words and numbers, lowercase and stemmed, without bold marks, the bullet dash, or small connecting words. */
export function contentTokens(text: string): string[] {
  const clean = text.replace(/\*\*/g, "").replace(/^\s*-\s+/, "").toLowerCase();
  const out: string[] = [];
  for (const m of clean.matchAll(/\$?\d[\d,]*(?:\.\d+)?%?|[a-z][a-z'-]*/g)) {
    const raw = m[0];
    const token = /\d/.test(raw) ? raw.replace(/[$,]/g, "").replace(/\.0+$/, "") : raw.replace(/'s$/, "");
    if (!STOP.has(token)) out.push(stem(token));
  }
  return out;
}

/** The opening verb in every tense it appears in, so "Build" and "Built" are the same claim. */
function verbForms(word: string): string[] {
  return [word, toPastTense(word), toPresentTense(word)].filter((w): w is string => Boolean(w)).map((w) => stem(w.toLowerCase()));
}

/**
 * The confirmed fact that says the same thing as `quote`, or null when none does.
 * `known` is words the line may use that facts do not hold, such as an employer's
 * or school's name, which appear in a letter's sentence but not in the fact itself.
 */
export function supportingFact(quote: string, facts: string[], known: string[] = []): string | null {
  const body = quote.replace(/\*\*/g, "").replace(/^\s*-\s+/, "").trim();
  const tokens = contentTokens(body);
  if (tokens.length < 4) return null;
  const given = new Set(known.flatMap(contentTokens));
  const firstWord = body.match(/^[A-Za-z]+/)?.[0];
  const opener = firstWord ? verbForms(firstWord) : [];
  for (const fact of facts) {
    const have = new Set(contentTokens(fact));
    if (!have.size) continue;
    const [first, ...rest] = tokens;
    const restSupported = rest.every((token) => have.has(token) || given.has(token));
    const openerSupported = have.has(first) || given.has(first) || opener.some((form) => have.has(form));
    if (restSupported && openerSupported) return fact;
  }
  return null;
}
