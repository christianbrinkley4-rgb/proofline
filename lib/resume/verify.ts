/**
 * The verification check: every number in a bullet must appear in one of the
 * confirmed facts it cites. This is what makes "never hallucinate" a property of
 * the code instead of a line in a prompt. The export quality gate blocks on it.
 */

const NUMBER = /\$?\d[\d,]*(?:\.\d+)?\s?(?:%|k|m|x|\+)?/gi;
const ORDINAL = /\b\d+(?:st|nd|rd|th)\b/gi;
/** Years and dates aren't claims to verify. */
const YEAR = /^(19|20)\d{2}$/;

const WORD_NUMBERS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", fifteen: "15", twenty: "20", thirty: "30", fifty: "50", hundred: "100",
  first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th",
  half: "50%", double: "2x", doubled: "2x", triple: "3x", tripled: "3x",
};

/** Canonical form of a number token: "$3,200" -> "3200", "40+" -> "40", "2nd" -> "2". */
export function canonical(token: string): string {
  return token
    .toLowerCase()
    .replace(/[$,+\s]/g, "")
    .replace(/(st|nd|rd|th)$/, "")
    .replace(/\.0+$/, "")
    .replace(/%$/, "%");
}

export function numbersIn(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(ORDINAL)) found.add(canonical(m[0]));
  for (const m of text.matchAll(NUMBER)) {
    const c = canonical(m[0]);
    if (c && !YEAR.test(c)) found.add(c);
  }
  return [...found];
}

function numbersInFacts(texts: string[]): Set<string> {
  const set = new Set<string>();
  for (const t of texts) {
    for (const n of numbersIn(t)) set.add(n);
    for (const word of t.toLowerCase().match(/[a-z]+/g) ?? []) {
      if (WORD_NUMBERS[word]) set.add(canonical(WORD_NUMBERS[word]));
    }
  }
  return set;
}

export type VerifyResult = { ok: boolean; numbers: string[]; unsupported: string[] };

/** Does every number in `bullet` appear in the cited facts? */
export function verifyBullet(bullet: string, citedFacts: string[]): VerifyResult {
  const numbers = numbersIn(bullet);
  const allowed = numbersInFacts(citedFacts);
  const unsupported = numbers.filter((n) => !allowed.has(n) && !allowed.has(n.replace(/%$/, "")));
  return { ok: citedFacts.some((fact) => fact.trim().length > 0) && unsupported.length === 0, numbers, unsupported };
}
