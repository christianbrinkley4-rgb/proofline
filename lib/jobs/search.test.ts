import { beforeEach, describe, expect, it, vi } from "vitest";
import { collapseLocations, isStale, STALE_DAYS } from "./collapse";
import { parseIntent } from "./intent";
import { resolvePlace } from "./locations";
import { boardsFor } from "./registry";
import { workdayQueriesFor } from "./roles";
import { boardJobs, clearBoardJobsCache, passesSearchFilters } from "./search";
import { fetchBoard } from "./sources/boards";
import { planMuseSearches } from "./sources/search-apis";
import type { NormalizedJob } from "./types";

vi.mock("./sources/boards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sources/boards")>();
  return { ...actual, fetchBoard: vi.fn() };
});

const mockedFetchBoard = vi.mocked(fetchBoard);

const job = (id: string, location: string, source: NormalizedJob["source"] = "themuse", daysAgo = 5): NormalizedJob => ({
  source, sourceId: id, company: "Walmart", title: "Corporate Intern, Finance and Accounting", location, mode: "onsite", level: "internship",
  url: `https://example.com/${id}`, description: null, department: null, employmentType: null, payMin: null, payMax: null, payPeriod: null,
  postedAt: new Date(Date.now() - daysAgo * 864e5),
});

describe("collapseLocations", () => {
  it("keeps one result per role and lists the other cities", () => {
    const { kept, alsoIn } = collapseLocations([job("a", "Bentonville, AR"), job("b", "Springdale, AR"), job("c", "Rogers, AR")], () => 0);
    expect(kept).toHaveLength(1);
    expect(alsoIn.get(`themuse|${kept[0].sourceId}`)).toHaveLength(2);
  });

  it("keeps the city that fits the search, then the most direct source", () => {
    const jobs = [job("a", "Bentonville, AR"), job("b", "Raleigh, NC"), job("c", "Rogers, AR", "workday")];
    expect(collapseLocations(jobs, (j) => (j.location === "Raleigh, NC" ? 2 : 0)).kept[0].sourceId).toBe("b");
    expect(collapseLocations(jobs, () => 0).kept[0].sourceId).toBe("c");
  });

  it("leaves different roles alone", () => {
    const other = { ...job("d", "Bentonville, AR"), title: "Tax Intern" };
    expect(collapseLocations([job("a", "Bentonville, AR"), other], () => 0).kept).toHaveLength(2);
  });
});

describe("isStale", () => {
  it("skips old aggregator listings but trusts employer boards", () => {
    expect(isStale(job("a", "Bentonville, AR", "themuse", STALE_DAYS + 5))).toBe(true);
    expect(isStale(job("a", "Bentonville, AR", "themuse", 30))).toBe(false);
    expect(isStale(job("a", "Bentonville, AR", "greenhouse", 400))).toBe(false);
  });
});

describe("source query planning", () => {
  it("searches both requested roles on Workday without increasing its two-page budget", () => {
    expect(workdayQueriesFor(["audit", "tax"], "internship")).toEqual(["Audit intern", "Tax intern"]);
    expect(workdayQueriesFor([], "any")).toEqual([""]);
  });

  it("gives distinct Muse categories their own bounded pages", () => {
    expect(planMuseSearches(["Entry Level"], ["Accounting and Finance", "Customer Service", "Customer Service"], ["Raleigh, NC"]))
      .toEqual([
        { levels: ["Entry Level"], categories: ["Accounting and Finance"], locations: ["Raleigh, NC"], pages: 2 },
        { levels: ["Entry Level"], categories: ["Customer Service"], locations: ["Raleigh, NC"], pages: 2 },
      ]);
  });
});

describe("boardsFor", () => {
  it("returns the full registry when there is no role signal", () => {
    expect(boardsFor([]).length).toBeGreaterThan(50);
    expect(boardsFor([])).toEqual(boardsFor(["unknown-role-xyz"]));
  });

  it("narrows to boards tagged for the role family", () => {
    const accounting = boardsFor(["accounting"]);
    const full = boardsFor([]);
    expect(accounting.length).toBeGreaterThan(0);
    expect(accounting.length).toBeLessThan(full.length);
    expect(accounting.every((b) => b.tags.some((t) => ["accounting", "fintech", "finance"].includes(t)))).toBe(true);
  });

  it("reaches wide for business searches instead of falling back by accident", () => {
    const business = boardsFor(["business"]);
    expect(business.length).toBeGreaterThan(boardsFor(["accounting"]).length);
    expect(business.some((b) => b.tags.includes("operations"))).toBe(true);
    expect(business.some((b) => b.tags.includes("consumer"))).toBe(true);
  });
});

describe("business search end to end", () => {
  it("keeps a Business Intern posting for a plain 'business' search", async () => {
    const { titleWordsFor } = await import("./roles");
    const intent = parseIntent("business internships");
    const posting = { ...job("biz", "Raleigh, NC", "greenhouse"), title: "Business Intern" };
    expect(passesSearchFilters(posting, intent, titleWordsFor(intent.roles), [])).toBe(true);
    const typo = parseIntent("buisness internships");
    expect(passesSearchFilters(posting, typo, titleWordsFor(typo.roles), [])).toBe(true);
  });
});

describe("boardJobs cache", () => {
  const ref = { source: "greenhouse" as const, slug: "cache-test-co", company: "Cache Test Co" };
  const listing = [job("1", "Raleigh, NC", "greenhouse")];

  beforeEach(() => {
    clearBoardJobsCache();
    mockedFetchBoard.mockReset();
  });

  it("shares one in-flight fetch across concurrent callers", async () => {
    let resolve!: (jobs: NormalizedJob[]) => void;
    mockedFetchBoard.mockReturnValue(new Promise((r) => { resolve = r; }));
    const a = boardJobs(ref);
    const b = boardJobs(ref);
    expect(mockedFetchBoard).toHaveBeenCalledTimes(1);
    resolve(listing);
    await expect(Promise.all([a, b])).resolves.toEqual([listing, listing]);
  });

  it("keeps prior good data on failure without caching an empty miss", async () => {
    mockedFetchBoard.mockResolvedValueOnce(listing);
    expect(await boardJobs(ref)).toEqual(listing);
    expect(mockedFetchBoard).toHaveBeenCalledTimes(1);

    // Expire TTL while keeping prior jobs in the cache entry path used by a refetch.
    const past = Date.now() + 31 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(past);
    mockedFetchBoard.mockRejectedValueOnce(new Error("board down"));
    expect(await boardJobs(ref)).toEqual(listing);
    expect(mockedFetchBoard).toHaveBeenCalledTimes(2);

    // Failed refresh did not sticky-cache []; another expired call still hits the network.
    vi.spyOn(Date, "now").mockReturnValue(past + 31 * 60 * 1000);
    mockedFetchBoard.mockRejectedValueOnce(new Error("still down"));
    expect(await boardJobs(ref)).toEqual(listing);
    expect(mockedFetchBoard).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
  });

  it("returns [] on failure when there is no prior data and does not sticky-cache empty", async () => {
    mockedFetchBoard.mockRejectedValueOnce(new Error("board down"));
    expect(await boardJobs(ref)).toEqual([]);
    mockedFetchBoard.mockResolvedValueOnce(listing);
    expect(await boardJobs(ref)).toEqual(listing);
    expect(mockedFetchBoard).toHaveBeenCalledTimes(2);
  });
});

describe("search filters", () => {
  it("honors remote-only searches even when a local posting matches the city", () => {
    const intent = parseIntent("remote only customer service roles in Raleigh");
    const places = [resolvePlace("Raleigh")];
    const base = { ...job("service", "Raleigh, NC"), title: "Customer Service Representative" };
    expect(passesSearchFilters({ ...base, mode: "onsite" }, intent, ["customer service"], places)).toBe(false);
    expect(passesSearchFilters({ ...base, mode: "remote" }, intent, ["customer service"], places)).toBe(true);
  });
  it("keeps international postings when the search has no place limit", () => {
    const intent = parseIntent("customer service jobs worldwide", { targetLocations: ["Raleigh, NC"] });
    expect(intent.locations).toEqual([]);
    expect(intent.roles).toContain("customer-service");
    const london = { ...job("global", "London, UK"), title: "Customer Service Representative" };
    expect(passesSearchFilters(london, intent, ["customer service"], [])).toBe(true);
  });
});
