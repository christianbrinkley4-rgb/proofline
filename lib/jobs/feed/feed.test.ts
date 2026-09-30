import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/lib/db";
import type { CandidateProfile, FitReport } from "@/lib/fit/engine";
import { indexCandidate, scoreFit } from "@/lib/fit/engine";
import { checkKnockouts, readScreens, type Knockout, type KnockoutCandidate } from "@/lib/fit/knockouts";
import { parseRequirements } from "@/lib/fit/requirements";
import { addFact, confirmFact } from "@/lib/kb/facts";
import { updateProfile } from "@/lib/kb/profile";
import { setMatchStatus } from "../store";
import type { NormalizedJob } from "../types";
import { compileFilters, defaultFilters, filtersFor, passesFeedFilters, type FeedFilters } from "./filters";
import { loadFeed } from "./load";
import { compareFeed, feedChips, feedReason, preferenceModel } from "./rank";
import { feedEligibility, refreshFeed } from "./refresh";

const NOW = new Date("2026-09-29T12:00:00Z");

const LONG = (body: string) => `${body}\n\n${"You will join a small team, learn the close process, and work with people across the company every week. ".repeat(5)}`;

const posting = (over: Partial<NormalizedJob> & { sourceId: string }): NormalizedJob => ({
  source: "greenhouse",
  company: "Acme",
  title: "Staff Accountant",
  location: "Raleigh, NC",
  mode: "onsite",
  level: "entry",
  url: `https://example.com/${over.sourceId}`,
  description: LONG("Requirements:\n- Excel\n- Reconciliations\nBachelor's degree in Accounting."),
  department: "Finance",
  employmentType: null,
  payMin: null,
  payMax: null,
  payPeriod: null,
  postedAt: new Date("2026-09-20T00:00:00Z"),
  ...over,
});

const ALL: FeedFilters = { keywords: "", places: "", remote: true, types: ["internship", "entry", "fulltime"], minScore: 0 };

describe("knockout screens", () => {
  const candidate: KnockoutCandidate = { gradDate: "2026-12", workAuthorization: "permanent_resident", targetLocations: ["Raleigh, NC"], workModes: [], openToRelocate: false, availableFrom: "2027-01" };
  const descriptions = [
    "Must be a U.S. citizen. The internship starts in June 2027.",
    "Start immediately. We sponsor visas.",
    "Summer 2027 internship program in Raleigh.",
    "Nothing about dates or authorization here.",
  ];
  it.each(descriptions)("gives the same result from stored screens as from the description: %s", (description) => {
    const job = { title: "Audit Intern", location: "Raleigh, NC", mode: "onsite" as const, description, requirements: parseRequirements(description) };
    const fromText = checkKnockouts(job, candidate, NOW);
    const fromScreens = checkKnockouts({ ...job, description: null, screens: readScreens(job.title, description) }, candidate, NOW);
    expect(fromScreens).toEqual(fromText);
  });
});

describe("feed filters", () => {
  it("starts students on internships and entry-level jobs, graduates on entry-level and full-time", () => {
    const base = { targetRoles: ["accounting"], targetLocations: ["Raleigh, NC", "Remote"], workModes: [], feedFilters: null };
    expect(defaultFilters({ ...base, gradDate: "2027-05" }, NOW)).toMatchObject({ keywords: "accounting", places: "Raleigh, NC", remote: true, types: ["internship", "entry"] });
    expect(defaultFilters({ ...base, gradDate: "2024-05" }, NOW).types).toEqual(["entry", "fulltime"]);
  });

  it("keeps saved filters and falls back when they're malformed", () => {
    const saved = { ...ALL, keywords: "tax" };
    const profile = { targetRoles: ["finance"], targetLocations: [], workModes: [], gradDate: null };
    expect(filtersFor({ ...profile, feedFilters: saved }, NOW).keywords).toBe("tax");
    expect(filtersFor({ ...profile, feedFilters: { types: ["nonsense"] } }, NOW).keywords).toBe("finance");
  });

  it("reads 'Raleigh, NC, Durham, NC' as two places", () => {
    expect(compileFilters({ ...ALL, places: "Raleigh, NC, Durham, NC" }).places.map((p) => p.state)).toEqual(["NC", "NC"]);
    expect(compileFilters({ ...ALL, places: "Charlotte; Boston, MA" }).places).toHaveLength(2);
  });

  it("matches role families, job types, and U.S. places", () => {
    const accounting = compileFilters({ ...ALL, keywords: "accounting" });
    const job = (title: string, over: Partial<NormalizedJob> = {}) => ({ title, level: "entry" as const, employmentType: null, location: "Raleigh, NC", mode: "onsite", ...over });
    expect(passesFeedFilters(job("Staff Auditor"), accounting)).toBe(true);
    expect(passesFeedFilters(job("Quality Assurance Engineer"), accounting)).toBe(false);
    expect(passesFeedFilters(job("Tax Associate", { location: "London, UK" }), accounting)).toBe(false);
    expect(passesFeedFilters(job("Tax Associate", { location: "Remote - US", mode: "remote" }), accounting)).toBe(true);
    expect(passesFeedFilters(job("Tax Associate", { location: "Remote - US", mode: "remote" }), compileFilters({ ...ALL, keywords: "tax", remote: false }))).toBe(false);
    expect(passesFeedFilters(job("Tax Intern", { level: "internship" }), compileFilters({ ...ALL, types: ["entry"] }))).toBe(false);
    expect(passesFeedFilters(job("Accountant", { level: "unknown", employmentType: "Part-time" }), accounting)).toBe(false);
    expect(passesFeedFilters(job("Tax Intern", { location: "Durham, NC" }), compileFilters({ ...ALL, places: "Charlotte, NC" }))).toBe(false);
  });
});

describe("feed eligibility", () => {
  it("keeps early-career U.S. postings with a scorable description", () => {
    expect(feedEligibility(posting({ sourceId: "a:1" }), NOW)).toBeNull();
    expect(feedEligibility(posting({ sourceId: "a:2", title: "Senior Accountant", level: "experienced" }), NOW)).toBe("experienced");
    expect(feedEligibility(posting({ sourceId: "a:3", description: "Apply now." }), NOW)).toBe("no_description");
    expect(feedEligibility(posting({ sourceId: "a:4", postedAt: new Date("2026-06-01T00:00:00Z") }), NOW)).toBe("too_old");
    expect(feedEligibility(posting({ sourceId: "a:5", level: "unknown", title: "Accountant", description: LONG("Requirements:\n- 5+ years of experience in accounting") }), NOW)).toBe("years");
    expect(feedEligibility(posting({ sourceId: "a:6", location: "Toronto, Canada" }), NOW)).toBe("outside_us");
  });
});

describe("feed ranking", () => {
  const fit = (score: number, over: Partial<FitReport["details"]> = {}) =>
    ({
      score,
      details: {
        requiredSkills: { note: "", matched: [], missing: [] },
        experience: { note: "", matched: [], missing: [] },
        education: { note: "", matched: [], missing: [] },
        preferredSkills: { note: "", matched: [], missing: [] },
        keywords: { note: "", matched: [], missing: [] },
        location: { note: "", matched: [], missing: [] },
        ...over,
      },
    }) as FitReport;

  it("puts a 95 with a knockout below an 80 without one", () => {
    const rows = [
      { score: 95, knockout: true, preference: 0, postedAt: null },
      { score: 80, knockout: false, preference: 0, postedAt: null },
    ];
    expect(rows.sort(compareFeed).map((r) => r.score)).toEqual([80, 95]);
  });

  it("moves similar roles up after a save and down after a dismissal, within a cap", () => {
    const prefer = preferenceModel([
      { title: "Tax Intern", company: "Acme", status: "saved" },
      { title: "Tax Associate", company: "Beta", status: "saved" },
      { title: "Software Engineer", company: "Gamma", status: "dismissed" },
    ]);
    expect(prefer({ title: "Tax Analyst", company: "Delta" })).toMatchObject({ points: 6, note: "Moved up: like jobs you saved" });
    expect(prefer({ title: "Software Engineer Intern", company: "Zeta" }).points).toBeLessThan(0);
    expect(prefer({ title: "Tax Intern", company: "Acme" }).points).toBeLessThanOrEqual(8);
    expect(preferenceModel([])({ title: "Tax Intern", company: "Acme" })).toEqual({ points: 0, note: null });
  });

  it("shows knockouts before matches in the two chips", () => {
    const knockouts: Knockout[] = [{ key: "location", label: "Location and work mode", status: "knockout", reason: "" }];
    expect(feedChips(knockouts, fit(70, { requiredSkills: { note: "", matched: ["Excel", "SQL"], missing: [] } }))).toEqual([
      { kind: "knockout", text: "Location and work mode" },
      { kind: "match", text: "Excel" },
    ]);
  });

  it("cites the person's own fact in the reason", () => {
    const candidate: CandidateProfile = {
      confirmedText: ["Reconciled 40 vendor accounts each month in Excel"], experienceTitles: [], hasInternship: false, major: null, minor: null, degree: null,
      gpa: null, gradDate: null, targetLocations: [], workModes: [], needsSponsorship: false, credentials: [],
    };
    const report = scoreFit({ title: "Staff Accountant", location: null, mode: "unknown", level: "entry", requirements: parseRequirements("Requirements:\n- Excel\n- SQL") }, candidate);
    expect(feedReason(report, candidate, indexCandidate(candidate))).toBe('Wants Excel; your facts show it, as in "Reconciled 40 vendor accounts each month in Excel". Not in your facts yet: SQL.');
  });
});

describe("refresh and load", () => {
  const userId = "feed-test-user";
  const board = { source: "greenhouse" as const, slug: "feedco", company: "FeedCo" };
  const other = { source: "lever" as const, slug: "downco", company: "DownCo" };
  const jobs = [
    posting({ sourceId: "feedco:1", company: "FeedCo", title: "Staff Accountant" }),
    posting({ sourceId: "feedco:2", company: "FeedCo", title: "Tax Intern", level: "internship", description: LONG("Must be a U.S. citizen.\nRequirements:\n- Excel\n- Tax research") }),
    posting({ sourceId: "feedco:3", company: "FeedCo", title: "Senior Tax Manager", level: "experienced" }),
    posting({ sourceId: "feedco:4", company: "FeedCo", title: "Audit Associate", location: "Charlotte, NC" }),
  ];

  beforeAll(async () => {
    await dbReady;
    await db.insert(schema.user).values({ id: userId, name: "Feed", email: "feed@example.com" }).onConflictDoNothing();
    await updateProfile(userId, { gradDate: "2026-12", workAuthorization: "permanent_resident", targetLocations: ["Raleigh, NC"], targetRoles: ["accounting"] });
    const fact = await addFact(userId, { category: "skill", content: "Reconciled 40 vendor accounts each month in Excel", source: "user_stated" });
    await confirmFact(userId, fact.id);
  }, 60_000);

  it("lists eligible postings, closes ones that leave their board, and keeps a failed board's listings", async () => {
    const first = await refreshFeed({
      boards: [board, other],
      now: NOW,
      fetch: async (ref) => (ref.slug === "feedco" ? jobs : [posting({ sourceId: "downco:1", source: "lever", company: "DownCo", title: "Accounting Intern", level: "internship" })]),
    });
    expect(first).toMatchObject({ listed: 4, closed: 0, boardsFailed: [] });
    expect(first.skipped.experienced).toBe(1);

    const second = await refreshFeed({
      boards: [board, other],
      now: new Date(NOW.getTime() + 864e5),
      fetch: async (ref) => {
        if (ref.slug === "downco") throw new Error("down");
        return jobs.filter((j) => j.sourceId !== "feedco:4");
      },
    });
    expect(second).toMatchObject({ listed: 2, closed: 1, boardsFailed: ["lever:downco"] });
    const closed = await db.query.job.findFirst({ where: eq(schema.job.sourceId, "feedco:4") });
    expect(closed?.closedAt).not.toBeNull();
    expect(closed?.listedAt).toBeNull();
    const kept = await db.query.job.findFirst({ where: eq(schema.job.sourceId, "downco:1") });
    expect(kept?.listedAt).not.toBeNull();
  });

  it("scores the pool for one person, knockouts last, and drops dismissed listings", async () => {
    const now = new Date(NOW.getTime() + 864e5 + 60_000);
    const feed = await loadFeed(userId, { now, filters: { ...ALL, keywords: "accounting" } });
    expect(feed.items.map((i) => i.title).slice(0, 2).sort()).toEqual(["Accounting Intern", "Staff Accountant"]);
    expect(feed.items[2].title).toBe("Tax Intern");
    expect(feed.items[0].score).toBeGreaterThanOrEqual(feed.items[1].score);
    const tax = feed.items.find((i) => i.title === "Tax Intern")!;
    expect(tax.knockout?.label).toBe("Work authorization");
    expect(tax.chips[0]).toEqual({ kind: "knockout", text: "Work authorization" });
    const accountant = feed.items.find((i) => i.title === "Staff Accountant")!;
    expect(accountant.reason).toContain("Reconciled 40 vendor accounts");

    await setMatchStatus(userId, accountant.jobId, "dismissed");
    const after = await loadFeed(userId, { now, filters: { ...ALL, keywords: "accounting" } });
    expect(after.items.map((i) => i.title)).not.toContain("Staff Accountant");
    expect(after.poolSize).toBe(3);
  });

  it("opens with the filters the person saved", async () => {
    await updateProfile(userId, { feedFilters: { ...ALL, keywords: "tax", types: ["internship"] } });
    const feed = await loadFeed(userId, { now: new Date(NOW.getTime() + 864e5 + 60_000) });
    expect(feed.filters.keywords).toBe("tax");
    expect(feed.items.map((i) => i.title)).toEqual(["Tax Intern"]);
  });
});

describe("a first feed with no target roles", () => {
  it("starts from the person's major, and leaves role keywords empty without one", () => {
    const base = { targetRoles: [], targetLocations: [], workModes: [], gradDate: "2027-06" };
    expect(defaultFilters({ ...base, major: "Accounting" }).keywords).toBe("accounting");
    expect(defaultFilters({ ...base, major: "Marketing" }).keywords).toBe("marketing");
    expect(defaultFilters({ ...base, major: "Art History" }).keywords).toBe("");
    expect(defaultFilters({ ...base, targetRoles: ["Audit intern"], major: "Accounting" }).keywords).toBe("Audit intern");
  });
});
