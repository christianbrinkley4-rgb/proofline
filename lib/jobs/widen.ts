import { RELATED_FAMILIES, ROLE_FAMILIES } from "./roles";
import type { JobIntent } from "./types";

/** Fewer matches than this and the search is thin enough to suggest a wider one. */
export const THIN_RESULTS = 5;

export type WiderSearch = { label: string; query: string; why: string };

/**
 * Next searches to try when one comes back thin. Keeps what the person asked for
 * (level, season, place, setup) and swaps in neighboring role families, then offers
 * the same role with the place or season dropped. Suggestions only: nothing here
 * claims those searches will find more.
 */
export function widerSearches(intent: JobIntent, limit = 3): WiderSearch[] {
  const out: WiderSearch[] = [];
  const known = intent.roles.filter((r) => ROLE_FAMILIES.some((f) => f.id === r));
  const related = [...new Set(known.flatMap((r) => RELATED_FAMILIES[r] ?? []))].filter((r) => !intent.roles.includes(r));

  for (const id of related) {
    const family = ROLE_FAMILIES.find((f) => f.id === id);
    if (!family) continue;
    out.push({ label: family.label, query: compose(family.label.toLowerCase(), intent), why: "A neighboring role that uses the same skills" });
  }

  const role = known.length ? ROLE_FAMILIES.find((f) => f.id === known[0])!.label.toLowerCase() : intent.roles.join(" ");
  if (role && intent.locations.length) {
    out.unshift({ label: `${capitalize(role)}, any location`, query: compose(role, { ...intent, locations: [] }, true), why: "Same role without the place limit" });
  }
  if (role && intent.term) {
    out.push({ label: `${capitalize(role)}, any season`, query: compose(role, { ...intent, term: null }), why: "Same role without the season" });
  }
  return dedupe(out).slice(0, limit);
}

function compose(role: string, intent: Pick<JobIntent, "level" | "term" | "locations" | "modes">, anywhere = false): string {
  const parts = [role];
  parts.push(intent.level === "internship" ? "internships" : intent.level === "entry" ? "entry-level roles" : "roles");
  if (intent.locations.length) parts.push(`in ${intent.locations[0]}`);
  if (intent.term) parts.push(`for ${intent.term.toLowerCase()}`);
  if (anywhere) parts.push("anywhere");
  else if (intent.modes.length === 1 && intent.modes[0] === "remote") parts.push("remote");
  return parts.join(" ");
}

function capitalize(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

function dedupe(items: WiderSearch[]) {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.query) ? false : (seen.add(item.query), true)));
}
