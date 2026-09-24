/**
 * Google's X-Y-Z formula without a model: "Accomplished X, as measured by Y, by
 * doing Z." Given what the student did (a draft bullet) and what changed because
 * of it (their own answer), it leads with the result and its number and ends with
 * the method. Every word comes from the two confirmed facts; nothing is added.
 */

const IRREGULAR_PAST: Record<string, string> = {
  built: "building", led: "leading", ran: "running", wrote: "writing", taught: "teaching", made: "making",
  cut: "cutting", set: "setting", put: "putting", won: "winning", grew: "growing", drove: "driving",
  oversaw: "overseeing", sold: "selling", kept: "keeping", caught: "catching", brought: "bringing", spoke: "speaking",
  gave: "giving", took: "taking", found: "finding", held: "holding", began: "beginning", chose: "choosing",
  drew: "drawing", met: "meeting", paid: "paying", sent: "sending", spent: "spending", told: "telling",
  thought: "thinking", did: "doing", had: "having", got: "getting", sat: "sitting", dealt: "dealing",
  undertook: "undertaking", became: "becoming", bought: "buying", came: "coming", went: "going", ate: "eating",
};

/** "Built" -> "building", "Reconciled" -> "reconciling", "Planned" -> "planning", "Studied" -> "studying". */
export function gerund(pastVerb: string): string {
  const w = pastVerb.toLowerCase();
  if (IRREGULAR_PAST[w]) return IRREGULAR_PAST[w];
  if (/ied$/.test(w)) return `${w.slice(0, -3)}ying`;
  if (/eed$/.test(w)) return `${w.slice(0, -1)}ing`;
  if (/ed$/.test(w)) return `${w.slice(0, -2)}ing`;
  if (/ing$/.test(w)) return w;
  return `${w}ing`;
}

const PAST_OPENER = /^(?:[A-Z][a-z]+ed|Built|Led|Ran|Wrote|Taught|Made|Cut|Set|Won|Grew|Drove|Oversaw|Sold|Kept|Caught|Brought|Spoke|Gave|Took|Found|Held|Began|Chose|Drew|Met|Paid|Sent|Spent|Told|Did|Got)\b/;

/** Words that open a result the student described ("saved", "cut", "got", "raised"). */
const RESULT_VERB = /^(saved|saving|save|cut|cutting|reduced|reducing|reduce|increased|increasing|increase|raised|raising|raise|grew|growing|grow|improved|improving|improve|caught|catching|catch|prevented|preventing|eliminated|eliminating|doubled|tripled|lowered|shortened|sped|won|winning|earned|earning|brought|boosted|recovered|freed|helped)\b/i;

const PAST: Record<string, string> = {
  saving: "saved", save: "saved", cutting: "cut", reducing: "reduced", reduce: "reduced", increasing: "increased",
  increase: "increased", raising: "raised", raise: "raised", growing: "grew", grow: "grew", improving: "improved",
  improve: "improved", catching: "caught", catch: "caught", preventing: "prevented", eliminating: "eliminated",
  winning: "won", earning: "earned",
};

/** An answer like "Result: it saved about 3 hours a week (Oakwood)" -> "Saved about 3 hours a week". */
export function resultClause(answer: string): string | null {
  const text = answer
    .replace(/^(result|impact|outcome)[^:]*:\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/^(it|that|this|we|i)\s+/i, "")
    .replace(/[.\s]+$/, "")
    .trim();
  const verb = text.match(RESULT_VERB)?.[1];
  if (!verb) return null;
  const past = PAST[verb.toLowerCase()] ?? verb.toLowerCase();
  return `${past[0].toUpperCase()}${past.slice(1)}${text.slice(verb.length)}`;
}

/**
 * "Built a weekly cash report" + "saved the office manager about 3 hours a week"
 * -> "Saved the office manager about 3 hours a week by building a weekly cash report".
 * Returns null when the pieces don't fit the pattern, so the caller keeps its draft.
 */
export function composeXyz(action: string, result: string): string | null {
  const clause = resultClause(result);
  const act = action.trim().replace(/[.\s]+$/, "");
  const opener = act.match(PAST_OPENER)?.[0];
  if (!clause || !opener) return null;
  const method = `${gerund(opener)}${act.slice(opener.length)}`;
  // Don't repeat the same verb on both sides ("Cut X by cutting Y").
  if (clause.split(" ")[0].toLowerCase() === opener.toLowerCase()) return null;
  const bullet = `${clause} by ${method}`;
  return bullet.length <= 220 ? bullet : null;
}
