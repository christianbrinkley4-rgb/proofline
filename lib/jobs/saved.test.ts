import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { diffResults, listWatched, markViewed, REFRESH_AFTER_MS, refreshDue, releaseFailedClaim, tryClaimDueSearch, unwatchSearch, watchedWithNews, watchSearch } from "./saved";

const userId = "test-user-saved";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("diffResults", () => {
  it("reports only postings the search hasn't shown before", () => {
    const next = diffResults([uuid(1), uuid(2)], [], [uuid(2), uuid(3), uuid(4)]);
    expect(next.fresh).toEqual([uuid(3), uuid(4)]);
    expect(next.seen).toEqual([uuid(3), uuid(4), uuid(1), uuid(2)]);
    expect(next.pending).toEqual([uuid(3), uuid(4)]);
  });

  it("keeps earlier news until it's viewed", () => {
    expect(diffResults([uuid(1)], [uuid(1)], [uuid(1), uuid(5)]).pending).toEqual([uuid(5), uuid(1)]);
  });
});

describe("watched searches", () => {
  beforeAll(async () => {
    await dbReady;
    await db.insert(schema.user).values({ id: userId, name: "Watcher", email: "watcher@example.com" }).onConflictDoNothing();
  }, 60_000);

  it("watches a query once, counting what's on screen as seen", async () => {
    const first = await watchSearch(userId, "accounting internships", [uuid(1)]);
    const again = await watchSearch(userId, "  Accounting   Internships ", [uuid(2)]);
    expect(again.id).toBe(first.id);
    expect(first.seenJobIds).toEqual([uuid(1)]);
    expect(await listWatched(userId)).toHaveLength(1);
  });

  it("shows new postings until the student opens the search", async () => {
    const [search] = await listWatched(userId);
    const [job] = await db
      .insert(schema.job)
      .values({ source: "greenhouse", sourceId: "x1", company: "Northwind", companySlug: "northwind", title: "Audit Intern", url: "https://example.com/1", dedupeKey: "northwind-audit" })
      .returning();
    await db.update(schema.savedSearch).set({ newJobIds: [job.id] }).where(eq(schema.savedSearch.id, search.id));
    const [view] = await watchedWithNews(userId);
    expect(view.fresh.map((f) => f.title)).toEqual(["Audit Intern"]);
    await markViewed(userId, search.id);
    expect((await watchedWithNews(userId))[0].fresh).toEqual([]);
  });

  it("claims a due search once and retries after a failed attempt", async () => {
    const [search] = await listWatched(userId);
    const previousRun = new Date(Date.now() - REFRESH_AFTER_MS - 60_000);
    await db.update(schema.savedSearch).set({ lastRunAt: previousRun }).where(eq(schema.savedSearch.id, search.id));
    const [due] = await listWatched(userId);
    const claimedAt = new Date();
    const cutoff = new Date(Date.now() - REFRESH_AFTER_MS);
    const claims = await Promise.all([
      tryClaimDueSearch(due, cutoff, claimedAt),
      tryClaimDueSearch(due, cutoff, claimedAt),
    ]);
    expect(claims.sort()).toEqual([false, true]);

    await releaseFailedClaim(due, claimedAt);
    const [retryable] = await listWatched(userId);
    expect(retryable.lastRunAt?.getTime()).toBe(previousRun.getTime());
    const retryAt = new Date();
    expect(await tryClaimDueSearch(retryable, cutoff, retryAt)).toBe(true);
    await releaseFailedClaim(retryable, retryAt);
    expect(await refreshDue({ userId, deadline: new Date(0) })).toBe(0);
  });

  it("stops watching", async () => {
    const [search] = await listWatched(userId);
    await unwatchSearch(userId, search.id);
    expect(await listWatched(userId)).toEqual([]);
  });
});
