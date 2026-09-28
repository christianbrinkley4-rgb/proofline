import { isActionVerb, OVERUSED_VERBS } from "./verbs";
import { toPastTense } from "./polish";
import { gerund } from "./xyz";

export type RecallXyz = { measure: string; method: string; result?: string };
export type RecallParts = RecallXyz & { action: string; result: string };
const clean = (value: string) => value.trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const stem = (value: string) => value.toLowerCase().replace(/ies$/, "y").replace(/s$/, "");
const CHANGE_VERBS = /^(reduced|increased|improved|raised|grew|cut|lowered|shortened|saved|doubled|tripled|boosted|recovered|eliminated|prevented)\b/i;

/** Preserve old parenthetical cards; new follow-ups use the saved structured inputs. */
export function recallXyzDefaults(statement: string): RecallParts {
  const action = statement.replace(/(?:, resulting in| using) \[[^\]]+\]$/, "").replace(/[.\s]+$/, "");
  const filled = action.match(/^(.+?) \(([^()]+)\) ((?:by|using|with|through) .+?)(?:, resulting in (.+))?$/);
  if (filled) return { action: filled[1], measure: filled[2], method: filled[3], result: filled[4] ?? "" };
  const method = action.match(/^(.+?) ((?:by|using|through) .+)$/);
  return method
    ? { action: method[1], measure: "", method: method[2], result: "" }
    : { action, measure: "", method: "", result: "" };
}

/** Change only person/tense, never upgrade a supporting role into ownership. */
function actionPhrase(value: string): string {
  const text = clean(value).replace(/^(?:I|we)\s+(?:was|were|am|are)\s+(?=\w+ing\b)/i, "").replace(/^(?:I|we)\s+(?:(?:have|had)\s+)?/i, "");
  const match = text.match(/^(\S+)(.*)$/);
  if (!match) return text;
  const verb = toPastTense(match[1]) ?? match[1].toLowerCase();
  return capitalize(verb) + match[2];
}

function methodPhrase(value: string): string {
  let text = clean(value).replace(/^(?:I|we)\s+(?:was|were|am|are)\s+(?=\w+ing\b)/i, "").replace(/^(?:I|we)\s+(?:(?:have|had)\s+)?/i, "").replace(/^to\s+/i, "");
  const existing = text.match(/^(by|through|with|using)\s+(.+)$/i);
  if (existing) text = existing[2];
  // Tools are nouns; actions are gerunds. "by Excel" and "by I checked" are
  // not grammatical methods, even though each contains the right information.
  if (/^(use|used|uses|using)\s+/i.test(text)) return `using ${text.replace(/^(use|used|uses|using)\s+/i, "")}`;
  const first = text.match(/^(\S+)(.*)$/);
  const past = first ? toPastTense(first[1]) ?? first[1] : "";
  if (first && isActionVerb(past)) {
    text = `${gerund(past)}${first[2]}`;
    text = text.replace(/\band (\w+)\b/gi, (whole, word: string) => {
      const parallel = toPastTense(word) ?? word;
      return isActionVerb(parallel) ? `and ${gerund(parallel)}` : whole;
    });
    return `${existing?.[1].toLowerCase() === "through" ? "through" : "by"} ${text}`;
  }
  if (/^[a-z]+ing\b/i.test(text) && !/^[^ ]+ (?:software|system|platform|tool|application|portal|database)\b/i.test(text)) return `${existing?.[1].toLowerCase() === "through" ? "through" : "by"} ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  return `${existing?.[1].toLowerCase() === "with" ? "with" : "using"} ${text}`;
}

function measuredAction(action: string, measure: string): string {
  if (/\[[^\]]+\]/.test(measure)) return `${action} ${measure}`;
  const escaped = measure.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, "i").test(action)) return action;
  if (/^(?:(?:daily|weekly|monthly|annually|hourly|nightly)|(?:each|every|per)\s+\w+|(?:once|twice|\d+ times)\s+(?:a|per|each)\s+\w+)$/i.test(measure)) return `${action} ${measure.charAt(0).toLowerCase()}${measure.slice(1)}`;
  if (/^(?:about |approximately |around |roughly |at least |up to |over |under )?\d[\d,.]*(?:%| percent)$/i.test(measure)) {
    if (!CHANGE_VERBS.test(action)) throw new Error("Fill in what the percentage measures, such as the share of orders or the change in errors");
    return `${action} by ${measure}`;
  }
  const quantity = measure.match(/^((?:(?:about|approximately|around|roughly|nearly|at least|up to|over|under|more than|less than)\s+)?[$£€]?\d[\d,.]*(?:\s*(?:-|to)\s*\d[\d,.]*)?)(?:\s+|$)(.*)$/i);
  if (!quantity) return `${action} for ${measure}`;
  const [, amount, rest] = quantity;
  const frequency = rest.match(/\s*\b((?:(?:each|every|per|a)\s+(?:\d+\s+)?(?:shift|day|week|month|year|hour|quarter|semester|minute)s?|daily|weekly|monthly|annually))$/i)?.[1] ?? "";
  const unit = (frequency ? rest.slice(0, rest.length - frequency.length) : rest).trim();
  const [verb, ...objectWords] = action.split(" ");
  const object = objectWords.join(" ");
  const core = object.split(/\s+(?:for|at|in|by|using|with|as|to|and|or)\s+/i)[0];
  const coreWords = core.split(" ");
  const coreStems = coreWords.map(stem);
  const unitWords = unit.split(" ").filter(Boolean);
  const unitStems = unitWords.map(stem);
  if (/^(?:a |the )?(?:team|group)$/i.test(core) && /^(?:people|colleagues|employees|members|students|volunteers|workers|engineers)$/i.test(unit)) return `${action} of ${measure}`;
  if (/^[$£€]/.test(amount) && /^(?:funds|payments|sales|revenue|donations|invoices|expenses|grants|transactions)$/i.test(core) && (!unit || stem(unit) === stem(core))) return `${verb} ${amount} in ${object}${frequency ? ` ${frequency}` : ""}`;
  if (!unit && /^(?:information|data|support|service|software|equipment|research|accuracy|efficiency|revenue|mail|inventory|stock|money|cash|funds|feedback)$/i.test(coreWords.at(-1)!)) throw new Error("Fill in what is counted, or use a frequency or a named percentage change");
  const sameObject = unitStems.at(-1) === coreStems.at(-1) && unitStems.every((word) => coreStems.includes(word));
  const sameUnit = sameObject || (unitStems.length === 1 && unitStems[0] === coreStems.at(-1));
  if (!unit || sameUnit) {
    let noun = object.replace(/^(?:a|an|the)\s+/i, "");
    if (/^(?:(?:about|approximately|around|roughly|nearly|at least|up to|over|under)\s+)?1(?:\.0+)?$/i.test(amount)) {
      const head = coreWords.at(-1)!;
      if (/s$/i.test(head) && !/^(?:news|series|species|business)$/i.test(head)) noun = noun.replace(new RegExp(`\\b${head}\\b`, "i"), stem(head));
    }
    return `${verb} ${amount.charAt(0).toLowerCase()}${amount.slice(1)} ${noun}${frequency ? ` ${frequency}` : ""}`;
  }
  // Payments and payment transactions denote the same counted activity.
  if (stem(core) === "payment" && stem(unit) === "transaction") return `${verb} ${amount} payment ${unit}${object.slice(core.length)}${frequency ? ` ${frequency}` : ""}`;
  // Keep a different unit attached to its own noun: 15 customers does not
  // become 15 complaints, 3 dentists does not become 3 appointments.
  return `${action} for ${measure}`;
}

function outcomePhrase(value: string): string | null {
  const normalized = actionPhrase(clean(value).replace(/^(?:it|this|that)\s+/i, ""));
  if (CHANGE_VERBS.test(normalized)) return normalized;
  const reduction = clean(value).match(/^((?:(?:about|approximately|around|roughly|at least|up to|over|under)\s+)?\d[\d,.]*(?:%| percent)) fewer (.+)$/i);
  if (reduction) return `Reduced ${reduction[2]} by ${reduction[1]}`;
  const change = clean(value).match(/^((?:(?:about|approximately|around|roughly|at least|up to|over|under)\s+)?\d[\d,.]*(?:%| percent)) (improvement|increase|decrease|reduction) in (.+)$/i);
  return change ? `${/^(decrease|reduction)$/i.test(change[2]) ? "Reduced" : /^increase$/i.test(change[2]) ? "Increased" : "Improved"} ${change[3]} by ${change[1]}` : null;
}

/** Live preview and server save share this wording; raw parts remain in fact data. */
export function composeRecallXyz(action: string, details: RecallXyz, draft = false): string {
  const x = actionPhrase(action);
  const y = clean(details.measure).replace(/\s*\/\s*(shift|day|week|month|year|hour|quarter)\b/gi, " per $1") || (draft ? "[count, frequency, or % change]" : "");
  const z = clean(details.method) || (draft ? "[how you did it]" : "");
  const result = clean(details.result ?? "");
  if (!draft && (!x || !y || !z || [x, y, z, result].some((part) => /[\[\]\n\r]/.test(part)))) throw new Error("Fill in the accomplishment, measure, and method before saving");
  const verb = x.split(/\s+/)[0];
  if (!isActionVerb(verb) || OVERUSED_VERBS.has(verb.toLowerCase())) throw new Error("Use a clear action verb and plain wording");
  const measureOutcome = outcomePhrase(y);
  const measured = measureOutcome && !CHANGE_VERBS.test(x) ? x : measuredAction(x, y);
  const method = /\[[^\]]+\]/.test(z) ? `by ${z}` : methodPhrase(z);
  const resultOutcome = result ? outcomePhrase(result) : null;
  const outcome = resultOutcome ?? measureOutcome;
  const connector = /\bby [^,]+$/.test(measured) && CHANGE_VERBS.test(measured) && method.startsWith("by ") ? `through ${method.slice(3)}` : method;
  let text = `${measured} ${connector}`;
  if (outcome && outcome.split(" ")[0].toLowerCase() !== verb.toLowerCase()) {
    const activity = `${gerund(verb)}${measured.slice(verb.length)}`;
    const lead = outcome.replace(/ by ((?:(?:about|approximately|around|roughly|at least|up to|over|under)\s+)?\d[\d,.]*(?:%| percent))$/i, " $1");
    text = `${lead} by ${activity}${method.startsWith("by ") ? ` and ${method.slice(3)}` : ` ${method}`}`;
  }
  if (measureOutcome && resultOutcome && measureOutcome !== resultOutcome) text += ` and ${measureOutcome.charAt(0).toLowerCase()}${measureOutcome.slice(1)}`;
  if (result && !resultOutcome) {
    const clause = actionPhrase(result.replace(/^(?:it|this|that)\s+/i, ""));
    text += isActionVerb(clause.split(" ")[0]) ? ` and ${clause.charAt(0).toLowerCase()}${clause.slice(1)}` : `, resulting in ${/^\d[\d,.]*(?:%| percent) (?:improvement|increase|decrease|reduction|growth)\b/i.test(result) ? "a " : ""}${result}`;
  }
  // No arithmetic, rounding, inferred percentages, or lost denominator values.
  const numbers = (value: string) => new Set(value.match(/\d[\d,]*(?:\.\d+)?(?:%| percent)?/g) ?? []);
  const supplied = numbers([action, details.measure, details.method, details.result].join(" "));
  const composed = numbers(text);
  if (supplied.size !== composed.size || [...supplied].some((number) => !composed.has(number))) throw new Error("Finish the bullet without changing a supplied number");
  if (!draft && text.length > 300) throw new Error("Finish the bullet in 300 characters or fewer without dropping a claim");
  return text;
}
