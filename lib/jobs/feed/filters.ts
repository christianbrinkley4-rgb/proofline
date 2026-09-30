import { z } from "zod";
import { titleMatches } from "@/lib/fit/engine";
import { isRemoteText, isUSLocation, matchesPlace, resolvePlace, type Place } from "../locations";
import { titleExcluded, titleWordsFor, familiesFor } from "../roles";
import type { JobLevel } from "../types";

/**
 * Find jobs filters. Saved on the profile so the feed opens the way the person left it.
 * The feed lists internships and early-career jobs in the U.S.; these narrow it further.
 */

export const FEED_TYPES = ["internship", "entry", "fulltime"] as const;
export type FeedType = (typeof FEED_TYPES)[number];

export const FEED_TYPE_LABEL: Record<FeedType, string> = {
  internship: "Internships",
  entry: "Entry-level",
  fulltime: "Other full-time",
};

export const MIN_SCORES = [0, 40, 55, 70] as const;

export const FeedFiltersSchema = z.object({
  /** Comma-separated role words, matched against titles ("accounting" also finds "Staff Auditor"). */
  keywords: z.string().trim().max(200).default(""),
  /** Comma-separated places. Empty means anywhere in the U.S. */
  places: z.string().trim().max(200).default(""),
  remote: z.boolean().default(true),
  types: z.array(z.enum(FEED_TYPES)).max(FEED_TYPES.length).default(["internship", "entry"]),
  minScore: z.number().int().min(0).max(100).default(0),
});
export type FeedFilters = z.infer<typeof FeedFiltersSchema>;

type ProfileForFilters = {
  targetRoles: string[];
  targetLocations: string[];
  workModes: string[];
  gradDate: string | null;
  /** Latest major, for a first feed when no target roles are saved. */
  major?: string | null;
  feedFilters?: Record<string, unknown> | null;
} | null | undefined;

/** "Accounting" becomes the accounting role family, so an accounting student starts on accounting, audit, and tax work. */
function rolesFromMajor(major: string | null | undefined): string {
  if (!major?.trim()) return "";
  const families = familiesFor(major.toLowerCase().split(/[^a-z&]+/).filter(Boolean));
  return families.length ? families.slice(0, 2).map((f) => f.triggers[0]).join(", ") : "";
}

/** Still in school, or graduating within the next year: lead with internships. */
function studentLike(gradDate: string | null, now: Date): boolean {
  if (!gradDate) return true;
  const [year, month = 6] = gradDate.split("-").map(Number);
  const monthsAway = (year - now.getFullYear()) * 12 + (month - (now.getMonth() + 1));
  return monthsAway > 0;
}

/** First visit: start from what the person already told us (target roles, places, work modes). */
export function defaultFilters(profile: ProfileForFilters, now = new Date()): FeedFilters {
  const places = (profile?.targetLocations ?? []).filter((l) => !/^remote$/i.test(l.trim()));
  const modes = profile?.workModes ?? [];
  const remote = !modes.length || modes.includes("remote") || (profile?.targetLocations ?? []).some((l) => /^remote$/i.test(l.trim()));
  return {
    keywords: ((profile?.targetRoles ?? []).length ? (profile?.targetRoles ?? []).join(", ") : rolesFromMajor(profile?.major)).slice(0, 200),
    places: places.join("; ").slice(0, 200),
    remote,
    types: studentLike(profile?.gradDate ?? null, now) ? ["internship", "entry"] : ["entry", "fulltime"],
    minScore: 0,
  };
}

/** Saved filters when they're valid, otherwise the defaults. */
export function filtersFor(profile: ProfileForFilters, now = new Date()): FeedFilters {
  const saved = FeedFiltersSchema.safeParse(profile?.feedFilters ?? undefined);
  return profile?.feedFilters && saved.success ? saved.data : defaultFilters(profile, now);
}

const split = (text: string, by: RegExp) => [...new Set(text.split(by).map((t) => t.trim()).filter(Boolean))];

export type CompiledFilters = {
  filters: FeedFilters;
  /** Each keyword term with the title words that count for it. */
  terms: Array<{ term: string; words: string[]; roles: string[] }>;
  places: Place[];
};

export function compileFilters(filters: FeedFilters): CompiledFilters {
  const terms = split(filters.keywords.toLowerCase(), /[,;]/).map((term) => {
    const tokens = term.split(/\s+/);
    const roles = familiesFor(tokens).map((f) => f.id);
    return { term, roles, words: [...new Set([...titleWordsFor(roles.length ? roles : [term]), term])] };
  });
  // "Raleigh, NC" contains a comma, so several places are separated by semicolons (a lone comma list of cities still works).
  const rawPlaces = filters.places.includes(";") ? split(filters.places, /;/) : placesFromCommas(filters.places);
  return { filters, terms, places: rawPlaces.map(resolvePlace).filter((p): p is Place => p !== null) };
}

/** "Raleigh, NC" is one place; "Raleigh, Durham, Charlotte" is three. */
function placesFromCommas(text: string): string[] {
  const parts = split(text, /,/);
  const out: string[] = [];
  for (const part of parts) {
    if (out.length && /^[A-Za-z]{2}$/.test(part)) out[out.length - 1] = `${out[out.length - 1]}, ${part}`;
    else out.push(part);
  }
  return out;
}

export type FeedTypeJob = { title: string; level: JobLevel; employmentType: string | null };

export function feedTypeOf(job: FeedTypeJob): FeedType | null {
  if (job.level === "internship") return "internship";
  if (job.level === "entry") return "entry";
  if (job.level === "experienced") return null;
  if (/\b(part[- ]time|contract|temporary|temp|seasonal|freelance)\b/i.test(`${job.employmentType ?? ""} ${job.title}`)) return null;
  return "fulltime";
}

export type FilterableJob = FeedTypeJob & { location: string | null; mode: string };

export function matchesKeywords(title: string, compiled: CompiledFilters): boolean {
  if (!compiled.terms.length) return true;
  return compiled.terms.some((t) => titleMatches(title, t.words) && !titleExcluded(title, t.roles));
}

/** U.S. listings only for now; remote counts when it's open to the U.S. */
export function matchesPlaces(job: Pick<FilterableJob, "location" | "mode">, compiled: CompiledFilters): boolean {
  const remote = job.mode === "remote" || isRemoteText(job.location);
  const where = job.location?.trim() ?? "";
  const broadlyRemote = /^remote$/i.test(where) || /\b(anywhere|worldwide|global)\b/i.test(where);
  if (remote) return compiled.filters.remote && (broadlyRemote || isUSLocation(where) || /\bus\b|\bu\.s\.|united states|north america/i.test(where));
  if (!compiled.places.length) return !where || isUSLocation(where);
  return compiled.places.some((p) => matchesPlace(where, p));
}

export function passesFeedFilters(job: FilterableJob, compiled: CompiledFilters): boolean {
  const type = feedTypeOf(job);
  if (!type || !compiled.filters.types.includes(type)) return false;
  return matchesKeywords(job.title, compiled) && matchesPlaces(job, compiled);
}

/** SQL prefilter: the title must contain at least one of these (lowercase) fragments. Empty means no prefilter. */
export function titleFragments(compiled: CompiledFilters): string[] {
  return [...new Set(compiled.terms.flatMap((t) => t.words))];
}
