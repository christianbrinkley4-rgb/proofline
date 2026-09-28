import { isActionVerb, OVERUSED_VERBS } from "./verbs";

export type RecallXyz = { measure: string; method: string; result?: string };

/** Blank draft values are cues, never evidence. Keep every supplied detail verbatim. */
export function recallXyzDefaults(statement: string) {
  const action = statement.replace(/(?:, resulting in| using) \[[^\]]+\]$/, "").replace(/[.\s]+$/, "");
  const filled = action.match(/^(.+?) \(([^()]+)\) ((?:by|using|with|through) .+?)(?:, resulting in (.+))?$/);
  if (filled) return { action: filled[1], measure: filled[2], method: filled[3], result: filled[4] ?? "" };
  // A duty can already describe its method. Offer that as editable Z instead
  // of repeating "by" and asking for a second method for the same work.
  const method = action.match(/^(.+?) ((?:by|using|through) .+)$/);
  return method
    ? { action: method[1], measure: "", method: method[2], result: "" }
    : { action, measure: "", method: "", result: "" };
}

export function composeRecallXyz(action: string, details: RecallXyz, draft = false): string {
  const clean = (text: string) => text.trim().replace(/[.\s]+$/, "");
  const x = clean(action);
  const y = clean(details.measure) || (draft ? "[count, frequency, or % change]" : "");
  const z = clean(details.method) || (draft ? "[how you did it]" : "");
  const result = clean(details.result ?? "");
  if (!draft && (!x || !y || !z || [x, y, z, result].some((part) => /[\[\]\n\r]/.test(part)))) {
    throw new Error("Fill in the accomplishment, measure, and method before saving");
  }
  const verb = x.split(/\s+/)[0];
  if (!isActionVerb(verb) || OVERUSED_VERBS.has(verb.toLowerCase())) throw new Error("Use a clear action verb and plain wording");
  const method = /^(by|using|with|through)\b/i.test(z) ? z : `by ${z}`;
  return `${x} (${y}) ${method}${result ? `, resulting in ${result}` : ""}`;
}
