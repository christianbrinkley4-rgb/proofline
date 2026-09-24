import { and, asc, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { getProfile } from "@/lib/kb/profile";
import { parseIntent } from "./intent";
import { searchJobs } from "./search";

/**
 * Watched searches. Each keeps the postings it has already shown; a refresh
 * reruns the search and collects anything new until the person looks.
 */

export type SavedSearch = typeof schema.savedSearch.$inferSelect;

const MAX_WATCHED = 10;
const MAX_SEEN = 1000;
/** Visits can refresh a watched search once it is four hours old. The hosted cron runs daily. */
export const REFRESH_AFTER_MS = 4 * 60 * 60 * 1000;

const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

/** What's new in a run: results the search hadn't shown before, newest discoveries first. */
export function diffResults(seen: string[], pending: string[], found: string[]): { seen: string[]; fresh: string[]; pending: string[] } {
  const seenSet = new Set(seen);
  const fresh = found.filter((id) => !seenSet.has(id));
  const nextSeen = [...new Set([...fresh, ...seen])].slice(0, MAX_SEEN);
  const nextPending = [...new Set([...fresh, ...pending])].slice(0, 100);
  return { seen: nextSeen, fresh, pending: nextPending };
}

export async function listWatched(userId: string): Promise<SavedSearch[]> {
  return db.query.savedSearch.findMany({ where: eq(schema.savedSearch.userId, userId), orderBy: [asc(schema.savedSearch.createdAt)] });
}

/** Starts watching a query. The results already on screen count as seen. */
export async function watchSearch(userId: string, query: string, shownJobIds: string[] = []): Promise<SavedSearch> {
  const q = z.string().trim().min(2).max(300).parse(query);
  const shown = z.array(z.uuid()).max(200).parse(shownJobIds);
  const existing = (await listWatched(userId)).find((s) => norm(s.query) === norm(q));
  if (existing) return existing;
  if ((await listWatched(userId)).length >= MAX_WATCHED) throw new Error(`You can watch up to ${MAX_WATCHED} searches. Stop watching one first.`);
  const profile = await getProfile(userId);
  const intent = parseIntent(q, {
    targetRoles: profile?.targetRoles,
    targetLocations: profile?.targetLocations,
    workModes: profile?.workModes,
    targetTerm: profile?.targetTerm,
  });
  const [row] = await db
    .insert(schema.savedSearch)
    .values({ userId, query: q, intent: intent as unknown as Record<string, unknown>, alerts: true, lastRunAt: new Date(), seenJobIds: shown })
    .returning();
  return row;
}

export async function unwatchSearch(userId: string, id: string) {
  await db.delete(schema.savedSearch).where(and(eq(schema.savedSearch.id, z.uuid().parse(id)), eq(schema.savedSearch.userId, userId)));
}

/** The person opened the search; its new postings are no longer new. */
export async function markViewed(userId: string, id: string) {
  await db.update(schema.savedSearch).set({ newJobIds: [] }).where(and(eq(schema.savedSearch.id, z.uuid().parse(id)), eq(schema.savedSearch.userId, userId)));
}

/** Reruns one watched search and records what's new. */
export async function refreshSearch(userId: string, id: string): Promise<{ fresh: number; total: number }> {
  const search = await db.query.savedSearch.findFirst({ where: and(eq(schema.savedSearch.id, z.uuid().parse(id)), eq(schema.savedSearch.userId, userId)) });
  if (!search) throw new Error("Saved search not found.");
  const { results } = await searchJobs(userId, search.query, () => {}, { savedSearchId: search.id });
  // Long shots aren't worth an alert.
  const found = results.filter((r) => r.score >= 40 && !r.cappedBy).map((r) => r.jobId);
  const next = diffResults(search.seenJobIds, search.newJobIds, found);
  await db
    .update(schema.savedSearch)
    .set({ seenJobIds: next.seen, newJobIds: next.pending, lastRunAt: new Date() })
    .where(eq(schema.savedSearch.id, search.id));
  return { fresh: next.fresh.length, total: results.length };
}

/** Atomically claim a due search; concurrent cron/page runs may select the same row. */
export async function tryClaimDueSearch(search: SavedSearch, cutoff: Date, claimedAt: Date): Promise<boolean> {
  const claimed = await db
    .update(schema.savedSearch)
    .set({ lastRunAt: claimedAt })
    .where(and(
      eq(schema.savedSearch.id, search.id),
      eq(schema.savedSearch.alerts, true),
      or(isNull(schema.savedSearch.lastRunAt), lt(schema.savedSearch.lastRunAt, cutoff)),
    ))
    .returning({ id: schema.savedSearch.id });
  return claimed.length === 1;
}

/** A failed attempt must not look like a successful check or wait another four hours. */
export async function releaseFailedClaim(search: SavedSearch, claimedAt: Date): Promise<void> {
  await db
    .update(schema.savedSearch)
    .set({ lastRunAt: search.lastRunAt })
    .where(and(eq(schema.savedSearch.id, search.id), eq(schema.savedSearch.lastRunAt, claimedAt)));
}

/** Refreshes watched searches that haven't run recently, oldest first. For the scheduler and page visits. */
export async function refreshDue(opts: { userId?: string; limit?: number; now?: Date; deadline?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - REFRESH_AFTER_MS);
  const due = await db.query.savedSearch.findMany({
    where: and(
      eq(schema.savedSearch.alerts, true),
      or(isNull(schema.savedSearch.lastRunAt), lt(schema.savedSearch.lastRunAt, cutoff)),
      opts.userId ? eq(schema.savedSearch.userId, opts.userId) : undefined,
    ),
    orderBy: [asc(schema.savedSearch.lastRunAt)],
    limit: opts.limit ?? 5,
  });
  let done = 0;
  for (const search of due) {
    // Leave time for the current search to finish before the host ends the function.
    if (opts.deadline && Date.now() >= opts.deadline.getTime()) break;
    const claimedAt = new Date();
    if (!(await tryClaimDueSearch(search, cutoff, claimedAt))) continue;
    try {
      await refreshSearch(search.userId, search.id);
      done++;
    } catch (error) {
      // A failed check keeps its last successful time and is eligible on the next run.
      try {
        await releaseFailedClaim(search, claimedAt);
      } catch (releaseError) {
        console.error("Could not release watched search claim", { searchId: search.id, error: releaseError });
      }
      console.error("Watched search refresh failed", { searchId: search.id, error });
    }
  }
  return done;
}

export type WatchedView = {
  id: string;
  query: string;
  lastRunAt: string | null;
  fresh: Array<{ jobId: string; title: string; company: string; location: string | null; fit: number | null }>;
};

/** Watched searches with their new postings, best fit first. */
export async function watchedWithNews(userId: string): Promise<WatchedView[]> {
  const searches = await db.query.savedSearch.findMany({ where: eq(schema.savedSearch.userId, userId), orderBy: [desc(schema.savedSearch.createdAt)] });
  const ids = [...new Set(searches.flatMap((s) => s.newJobIds))];
  const [jobs, matches] = ids.length
    ? await Promise.all([
        db.query.job.findMany({ where: inArray(schema.job.id, ids), columns: { id: true, title: true, company: true, location: true, closedAt: true } }),
        db.query.jobMatch.findMany({ where: and(eq(schema.jobMatch.userId, userId), inArray(schema.jobMatch.jobId, ids)), columns: { jobId: true, fitScore: true, status: true } }),
      ])
    : [[], []];
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const matchById = new Map(matches.map((m) => [m.jobId, m]));
  return searches.map((s) => ({
    id: s.id,
    query: s.query,
    lastRunAt: s.lastRunAt?.toISOString() ?? null,
    fresh: s.newJobIds
      .flatMap((id) => {
        const job = jobById.get(id);
        const match = matchById.get(id);
        if (!job || job.closedAt || match?.status === "dismissed") return [];
        return [{ jobId: id, title: job.title, company: job.company, location: job.location, fit: match?.fitScore ?? null }];
      })
      .sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0)),
  }));
}
