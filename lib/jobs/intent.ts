import { familiesFor } from "./roles";
import { METROS, STATES } from "./locations";
import type { JobIntent } from "./types";

/**
 * Plain-language job search -> structured intent. Rules only, so it's instant and
 * free; it covers how people actually phrase searches. The profile fills gaps
 * the query leaves (no location typed? use the ones from onboarding).
 */

const STOP = new Set(
  "a an the for in at near around within of to and or with that which who me my i im i'm find show get looking look want need some any anything something jobs job roles role positions position openings opening opportunities opportunity please friendly based area miles mile mi good great best cool new latest today this week month year now open hiring".split(
    " ",
  ),
);

const CITY_WORDS = new Set(METROS.flatMap((m) => m.cities));
const STATE_NAMES = Object.values(STATES).map((s) => s.toLowerCase());

export type IntentDefaults = {
  targetRoles?: string[];
  targetLocations?: string[];
  workModes?: Array<"remote" | "hybrid" | "onsite">;
  targetTerm?: string | null;
  payFloor?: number | null;
};

export function parseIntent(query: string, defaults: IntentDefaults = {}): JobIntent {
  let q = ` ${query.toLowerCase().replace(/[“”"]/g, " ").replace(/\s+/g, " ")} `;

  // Exclusions: "that don't require the CPA", "not sales", "no unpaid", "without travel", "excluding X"
  const exclude: string[] = [];
  q = q.replace(/\b(?:that|which)?\s*(?:don'?t|do not|doesn'?t|does not)\s+(?:require|need)\s+(?:the\s+|a\s+|an\s+)?([a-z0-9&+ ]+?)(?:\s+yet)?(?=[,.;]| and | or |$| $)/g, (_m, w: string) => {
    exclude.push(w.trim());
    return " ";
  });
  q = q.replace(/\b(?:not|no|without|excluding|except)\s+([a-z0-9&+]+(?:\s+[a-z0-9&+]+)?)/g, (_m, w: string) => {
    exclude.push(w.trim());
    return " ";
  });

  // Pay: "$25/hr", "at least $20 an hour", "over 70k"
  let payFloor: JobIntent["payFloor"] = null;
  q = q.replace(/(?:at least|over|above|min(?:imum)?|paying|pays|>=?)?\s*\$\s?(\d[\d,]*)(k)?\s*(?:\/|per|an?)?\s*(hour|hr|h|year|yr)?/g, (_m, n: string, k: string, unit: string) => {
    const amount = Number(n.replace(/,/g, "")) * (k ? 1000 : 1);
    payFloor = { amount, period: unit ? (/^h/.test(unit) ? "hour" : "year") : amount < 500 ? "hour" : "year" };
    return " ";
  });

  // Term: "summer 2027", "fall '26"
  let term: string | null = null;
  q = q.replace(/\b(summer|fall|spring|winter)\s*'?(\d{2}|\d{4})\b/g, (_m, season: string, year: string) => {
    term = `${season[0].toUpperCase()}${season.slice(1)} ${year.length === 2 ? `20${year}` : year}`;
    return " ";
  });

  // "Remote or anywhere", "anywhere in the US", "any location": no place or setup limits, not even the profile's.
  let anywhere = false;
  q = q.replace(/\b(?:remote\s+or\s+)?(?:anywhere|any ?where|any location|any city|nationwide|all locations)(?:\s+in\s+the\s+(?:us|u\.s\.|usa|united states|country))?(?:\s+or\s+remote)?\b/g, () => {
    anywhere = true;
    return " ";
  });
  q = q.replace(/\bremote\s+or\s+(?:in[- ]person|on-?site|in[- ]office|hybrid)\b|\b(?:in[- ]person|on-?site|hybrid)\s+or\s+remote\b/g, () => {
    anywhere = true;
    return " ";
  });

  // Work mode
  const modes = new Set<"remote" | "hybrid" | "onsite">();
  q = q.replace(/\bremote[- ]?(friendly|ok|okay|optional|possible)\b/g, () => {
    modes.add("remote");
    modes.add("hybrid");
    return " ";
  });
  q = q.replace(/\b(fully remote|remote only|work from home|wfh|remote)\b/g, () => {
    modes.add("remote");
    return " ";
  });
  q = q.replace(/\bhybrid\b/g, () => {
    modes.add("hybrid");
    return " ";
  });
  q = q.replace(/\b(on-?site|in[- ]person|in[- ]office)\b/g, () => {
    modes.add("onsite");
    return " ";
  });

  // Level
  let level: JobIntent["level"] = "any";
  q = q.replace(/\b(internships?|interns?|co-?ops?|summer analyst)\b/g, () => {
    level = "internship";
    return " ";
  });
  q = q.replace(/\b(new grad(uate)?s?|entry[- ]level|junior|early career|full[- ]time|first job)\b/g, () => {
    if (level === "any") level = "entry";
    return " ";
  });

  // Locations: "in Raleigh, NC", "near Charlotte", "within 50 miles of Durham", bare city or state names
  const locations: string[] = [];
  q = q.replace(/\b(?:\d+\s*(?:miles?|mi)\s+(?:of|from)|in|near|around|within|by|close to)\s+([a-z .'-]+?)(?:,\s*([a-z]{2}|[a-z ]+?))?(?=[,.;]| for | that | which | with | and | or | remote| hybrid| paying| over| at least|$| $)/g,
    (m, city: string, state?: string) => {
      const c = city.trim();
      if (!c || STOP.has(c)) return m;
      const known = CITY_WORDS.has(c) || STATE_NAMES.includes(c) || STATES[c.toUpperCase()];
      if (!known && !state) return m;
      locations.push(state ? `${titleCase(c)}, ${state.length === 2 ? state.toUpperCase() : titleCase(state.trim())}` : titleCase(c));
      return " ";
    },
  );
  for (const city of CITY_WORDS) {
    if (city.length > 3 && q.includes(` ${city} `)) {
      locations.push(titleCase(city));
      q = q.replace(` ${city} `, " ");
    }
  }

  const words = q
    .replace(/[^a-z0-9&+ ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));

  // Keep multi-word role phrases together when a family knows them ("investment banking").
  const families = familiesFor(words);
  const profileRoles = [...new Set((defaults.targetRoles ?? []).flatMap((r) => familiesFor(r.toLowerCase().split(/\s+/)).map((f) => f.id)))];
  const roles = families.length ? families.map((f) => f.id) : words.length ? words.slice(0, 4) : profileRoles;

  return {
    query: query.trim(),
    roles,
    level: level === "any" && (defaults.targetRoles ?? []).some((r) => /intern/i.test(r)) ? "internship" : level,
    term: term ?? defaults.targetTerm ?? null,
    locations: locations.length ? dedupe(locations) : anywhere ? [] : (defaults.targetLocations ?? []).filter((l) => !/^remote$/i.test(l)),
    modes: modes.size ? [...modes] : anywhere ? [] : (defaults.workModes ?? []),
    exclude: dedupe(exclude),
    payFloor: payFloor ?? (defaults.payFloor ? { amount: defaults.payFloor, period: defaults.payFloor < 500 ? "hour" : "year" } : null),
  };
}

function titleCase(s: string) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Short, readable chips for the UI: "Accounting", "Internship", "Summer 2027", "Raleigh area", "Remote or hybrid". */
export function describeIntent(intent: JobIntent): Array<{ label: string; value: string }> {
  const chips: Array<{ label: string; value: string }> = [];
  if (intent.roles.length) chips.push({ label: "Role", value: intent.roles.map((r) => r[0].toUpperCase() + r.slice(1)).join(", ") });
  if (intent.level !== "any") chips.push({ label: "Level", value: intent.level === "internship" ? "Internship" : "Entry level" });
  if (intent.term) chips.push({ label: "When", value: intent.term });
  if (intent.locations.length) chips.push({ label: "Where", value: intent.locations.join(", ") });
  if (intent.modes.length) chips.push({ label: "Mode", value: intent.modes.map((m) => m[0].toUpperCase() + m.slice(1)).join(" or ") });
  if (intent.payFloor) chips.push({ label: "Pay", value: `$${intent.payFloor.amount}${intent.payFloor.period === "hour" ? "/hr" : "/yr"}+` });
  if (intent.exclude.length) chips.push({ label: "Skip", value: intent.exclude.join(", ") });
  return chips;
}
