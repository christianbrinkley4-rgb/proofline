/** Plain-language overlap catches role-specific work outside the named skill taxonomy. */
const STOP = new Set([
  "about", "after", "along", "also", "among", "and", "are", "based", "before", "both", "can", "company", "current",
  "each", "every", "experience", "experienced", "from", "have", "help", "include", "into", "keeping", "looking", "more",
  "must", "need", "other", "our", "preferred", "prepare", "provide", "qualified", "qualifications", "related", "required",
  "responsibilities", "role", "should", "skills", "strong", "support", "tasks", "team", "that", "their", "them", "there",
  "these", "this", "through", "using", "with", "work", "working", "would", "your",
]);

function stem(word: string): string {
  if (word.length > 6 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((word) => !STOP.has(word)).map(stem);
}

/** Repeated posting terms carry more weight than one-off boilerplate. */
export function postingOverlap(evidence: string, description: string | null | undefined): number {
  if (!description) return 0;
  const posting = new Map<string, number>();
  for (const term of terms(description.slice(0, 12_000))) posting.set(term, (posting.get(term) ?? 0) + 1);
  const evidenceTerms = new Set(terms(evidence));
  return Math.min(4, [...evidenceTerms].reduce((score, term) => score + Math.min(2, posting.get(term) ?? 0), 0));
}
