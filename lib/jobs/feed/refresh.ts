import { and, eq, inArray, isNotNull, like } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { parseRequirements } from "@/lib/fit/requirements";
import { BOARDS } from "../registry";
import { fetchBoard, fetchBoardDetail, type BoardFetchOptions, type BoardRef } from "../sources/boards";
import { mapLimit } from "../sources/http";
import { upsertJobs } from "../store";
import { dedupeKey } from "../text";
import type { NormalizedJob } from "../types";
import { compileFilters, feedTypeOf, matchesPlaces } from "./filters";

/**
 * Daily refresh of the Find jobs pool. Every employer board in the registry is read
 * through its public API. Those APIs list only open postings, so a posting that
 * leaves its board is marked closed and leaves the feed; a board that fails to load
 * keeps yesterday's listings until the feed's window runs out (FEED_WINDOW_MS).
 */

/** Older postings are usually filled or from a past hiring cycle. */
export const MAX_AGE_DAYS = 60;
/** Too short to score honestly (a title and a link, or a one-line blurb). */
export const MIN_DESCRIPTION = 400;
/** How long a listing stays in the feed without a refresh confirming it's still open. */
export const FEED_WINDOW_MS = 3 * 864e5;

export type Ineligible = "experienced" | "part_time" | "no_description" | "too_old" | "years" | "outside_us";

const US_ANYWHERE = compileFilters({ keywords: "", places: "", remote: true, types: ["internship", "entry", "fulltime"], minScore: 0 });

/** Internships and early-career jobs in the U.S. with a description we can score. */
export function feedEligibility(job: NormalizedJob, now = new Date()): Ineligible | null {
  if (!feedTypeOf(job)) return job.level === "experienced" ? "experienced" : "part_time";
  if (!job.description || job.description.trim().length < MIN_DESCRIPTION) return "no_description";
  if (job.postedAt && !Number.isNaN(job.postedAt.getTime()) && now.getTime() - job.postedAt.getTime() > MAX_AGE_DAYS * 864e5) return "too_old";
  const years = parseRequirements(job.description).yearsExperience;
  if (job.level !== "internship" && years !== null && years >= 3) return "years";
  if (!matchesPlaces(job, US_ANYWHERE)) return "outside_us";
  return null;
}

export type FeedRefreshStats = {
  boards: number;
  boardsFailed: string[];
  fetched: number;
  listed: number;
  closed: number;
  delisted: number;
  skipped: Partial<Record<Ineligible, number>>;
  ms: number;
};

type Fetcher = (ref: BoardRef, opts: BoardFetchOptions) => Promise<NormalizedJob[]>;
type DetailFetcher = typeof fetchBoardDetail;

const CHUNK = 500;

async function inChunks<T>(items: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += CHUNK) await fn(items.slice(i, i + CHUNK));
}

export async function refreshFeed(
  opts: { boards?: BoardRef[]; deadline?: Date; now?: Date; fetch?: Fetcher; fetchDetail?: DetailFetcher } = {},
): Promise<FeedRefreshStats> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const boards = opts.boards ?? BOARDS;
  const fetcher = opts.fetch ?? fetchBoard;
  const fetchDetail = opts.fetchDetail ?? fetchBoardDetail;
  const beforeDeadline = () => !opts.deadline || Date.now() < opts.deadline.getTime();

  const loaded: Array<{ ref: BoardRef; jobs: NormalizedJob[] }> = [];
  const boardsFailed: string[] = [];
  await mapLimit(boards, 6, async (ref) => {
    if (!beforeDeadline()) return void boardsFailed.push(`${ref.source}:${ref.slug}`);
    try {
      loaded.push({ ref, jobs: await fetcher(ref, { withContent: true, timeoutMs: 90_000 }) });
    } catch {
      boardsFailed.push(`${ref.source}:${ref.slug}`);
    }
  });

  // SmartRecruiters lists postings without descriptions; read the early-career ones.
  const needDetail = loaded.flatMap(({ jobs }) => jobs.filter((j) => !j.description && feedTypeOf(j)));
  await mapLimit(needDetail, 8, async (job) => {
    if (!beforeDeadline()) return;
    const detail = await fetchDetail(job.source, job.sourceId).catch(() => null);
    if (detail) Object.assign(job, detail);
  });

  const skipped: FeedRefreshStats["skipped"] = {};
  const eligible = new Map<string, NormalizedJob>();
  let fetched = 0;
  for (const { jobs } of loaded) {
    for (const job of jobs) {
      fetched++;
      const reason = feedEligibility(job, now);
      if (reason) {
        skipped[reason] = (skipped[reason] ?? 0) + 1;
        continue;
      }
      // One role posted twice at the same place (two boards, or a repost) is one listing.
      const key = dedupeKey(job.company, job.title, job.location);
      if (!eligible.has(key)) eligible.set(key, job);
    }
  }

  const rows = await upsertJobs([...eligible.values()]);
  const listedIds = [...rows.values()].map((r) => r.id);
  await inChunks(listedIds, (ids) => db.update(schema.job).set({ listedAt: now, closedAt: null }).where(inArray(schema.job.id, ids)));

  // Listings from boards that loaded: gone from the board means closed; still there but no longer eligible (too old) means out of the feed.
  const listedSet = new Set(listedIds);
  const closeIds: string[] = [];
  const delistIds: string[] = [];
  for (const { ref, jobs } of loaded) {
    const onBoard = new Set(jobs.map((j) => j.sourceId));
    const current = await db.query.job.findMany({
      where: and(eq(schema.job.source, ref.source), like(schema.job.sourceId, `${ref.slug}:%`), isNotNull(schema.job.listedAt)),
      columns: { id: true, sourceId: true },
    });
    for (const row of current) {
      if (listedSet.has(row.id)) continue;
      (onBoard.has(row.sourceId) ? delistIds : closeIds).push(row.id);
    }
  }
  await inChunks(closeIds, (ids) => db.update(schema.job).set({ listedAt: null, closedAt: now }).where(inArray(schema.job.id, ids)));
  await inChunks(delistIds, (ids) => db.update(schema.job).set({ listedAt: null }).where(inArray(schema.job.id, ids)));

  return {
    boards: boards.length,
    boardsFailed: boardsFailed.sort(),
    fetched,
    listed: listedIds.length,
    closed: closeIds.length,
    delisted: delistIds.length,
    skipped,
    ms: Date.now() - started,
  };
}
