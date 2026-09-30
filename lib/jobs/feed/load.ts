import { and, count, countDistinct, eq, gt, ilike, inArray, isNull, max, or, type SQL } from "drizzle-orm";
import { dealBreakerMatches } from "@/lib/agent/learn";
import { db, schema } from "@/lib/db";
import { loadCandidate } from "@/lib/fit/candidate";
import { indexCandidate, scoreFit } from "@/lib/fit/engine";
import { checkKnockouts, firstKnockout, knockoutCandidate } from "@/lib/fit/knockouts";
import { FIT_BAND_LABEL, fitBand } from "@/lib/fit/rubric";
import { getProfile } from "@/lib/kb/profile";
import { formatPay } from "../search";
import { requirementsOf, screensOf, type JobRow } from "../store";
import type { JobLevel } from "../types";
import { compileFilters, feedTypeOf, filtersFor, passesFeedFilters, titleFragments, type FeedFilters, type FeedType } from "./filters";
import { compareFeed, feedChips, feedReason, preferenceModel, type FeedChip, type FeedSignal } from "./rank";
import { FEED_WINDOW_MS } from "./refresh";

/**
 * The Find jobs feed for one person: every open listing in the pool that passes their
 * filters, scored with the same engine and knockout checks as a pasted job, ranked
 * with knockouts last. Nothing is stored; opening a listing saves it like any job.
 */

export type FeedItem = {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  mode: string;
  type: FeedType;
  pay: string | null;
  postedAt: string | null;
  score: number;
  band: string;
  knockout: { label: string; reason: string } | null;
  chips: FeedChip[];
  reason: string;
  preferenceNote: string | null;
  saved: boolean;
  /** Other places the same role is listed. */
  alsoIn: string[];
};

export type Feed = {
  filters: FeedFilters;
  items: FeedItem[];
  /** Listings that pass the filters, before the limit. Same role in several places counts once. */
  total: number;
  belowMinScore: number;
  /** Open listings in the whole pool, before filters. */
  poolSize: number;
  employers: number;
  updatedAt: Date | null;
};

const LEVELS: Record<FeedType, JobLevel> = { internship: "internship", entry: "entry", fulltime: "unknown" };

const LEAN_COLUMNS = {
  id: true, source: true, company: true, title: true, location: true, mode: true, level: true, department: true,
  employmentType: true, payMin: true, payMax: true, payPeriod: true, postedAt: true, requirements: true, keywords: true, screens: true,
} as const;

type LeanRow = Pick<JobRow, keyof typeof LEAN_COLUMNS>;

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function loadFeed(userId: string, opts: { limit?: number; filters?: FeedFilters; now?: Date } = {}): Promise<Feed> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - FEED_WINDOW_MS);
  const open = and(gt(schema.job.listedAt, since), isNull(schema.job.closedAt));

  const [profile, candidate, signals, [pool]] = await Promise.all([
    getProfile(userId),
    loadCandidate(userId),
    db
      .select({ jobId: schema.jobMatch.jobId, status: schema.jobMatch.status, title: schema.job.title, company: schema.job.company })
      .from(schema.jobMatch)
      .innerJoin(schema.job, eq(schema.job.id, schema.jobMatch.jobId))
      .where(and(eq(schema.jobMatch.userId, userId), inArray(schema.jobMatch.status, ["saved", "dismissed"])))
      .limit(1000),
    db
      .select({ updatedAt: max(schema.job.listedAt), listings: count(), employers: countDistinct(schema.job.companySlug) })
      .from(schema.job)
      .where(open),
  ]);

  const filters = opts.filters ?? filtersFor(profile, now);
  const compiled = compileFilters(filters);
  const fragments = titleFragments(compiled);
  const conditions: SQL[] = [open!, inArray(schema.job.level, filters.types.map((t) => LEVELS[t]))];
  if (fragments.length) conditions.push(or(...fragments.map((f) => ilike(schema.job.title, `%${escapeLike(f)}%`)))!);

  const rows: LeanRow[] = filters.types.length ? await db.query.job.findMany({ where: and(...conditions), columns: LEAN_COLUMNS }) : [];

  const status = new Map(signals.map((s) => [s.jobId, s.status]));
  const prefer = preferenceModel(signals.map((s): FeedSignal => ({ title: s.title, company: s.company, status: s.status as FeedSignal["status"] })));
  const index = indexCandidate(candidate);
  const knockoutFor = knockoutCandidate(profile);
  const dealBreakers = profile?.dealBreakers ?? [];

  let belowMinScore = 0;
  const scored = [];
  for (const row of rows) {
    if (status.get(row.id) === "dismissed") continue;
    const type = feedTypeOf(row);
    if (!type || !passesFeedFilters(row, compiled)) continue;
    if (dealBreakerMatches(dealBreakers, row)) continue;
    const requirements = requirementsOf({ ...row, description: null } as JobRow);
    const fit = scoreFit({ title: row.title, location: row.location, mode: row.mode, level: row.level, requirements, keywords: row.keywords }, candidate, index);
    if (fit.score < filters.minScore) {
      belowMinScore++;
      continue;
    }
    const knockouts = checkKnockouts({ title: row.title, location: row.location, mode: row.mode, description: null, requirements, screens: screensOf(row) }, knockoutFor, now);
    const knockout = firstKnockout(knockouts);
    const preference = prefer(row);
    scored.push({ row, type, fit, knockouts, knockout, preference, score: fit.score, postedAt: row.postedAt });
  }
  scored.sort((a, b) => compareFeed({ ...a, knockout: Boolean(a.knockout), preference: a.preference.points }, { ...b, knockout: Boolean(b.knockout), preference: b.preference.points }));

  // The same role at one employer in several cities is one listing, shown where it ranks best.
  const byRole = new Map<string, { first: (typeof scored)[number]; alsoIn: string[] }>();
  for (const item of scored) {
    const key = `${item.row.company.toLowerCase().replace(/[^a-z0-9]/g, "")}|${item.row.title.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const group = byRole.get(key);
    if (!group) byRole.set(key, { first: item, alsoIn: [] });
    else if (item.row.location && item.row.location !== group.first.row.location && !group.alsoIn.includes(item.row.location)) group.alsoIn.push(item.row.location);
  }
  const unique = [...byRole.values()];

  const items: FeedItem[] = unique.slice(0, opts.limit ?? 30).map(({ first: { row, type, fit, knockouts, knockout, preference }, alsoIn }) => ({
    jobId: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    mode: row.mode,
    type,
    pay: formatPay(row),
    postedAt: row.postedAt?.toISOString() ?? null,
    score: fit.score,
    band: FIT_BAND_LABEL[fitBand(fit.score)],
    knockout: knockout ? { label: knockout.label, reason: knockout.reason } : null,
    chips: feedChips(knockouts, fit),
    reason: feedReason(fit, candidate, index),
    preferenceNote: knockout ? null : preference.note,
    saved: status.get(row.id) === "saved",
    alsoIn,
  }));

  return { filters, items, total: unique.length, belowMinScore, poolSize: pool?.listings ?? 0, employers: pool?.employers ?? 0, updatedAt: pool?.updatedAt ?? null };
}
