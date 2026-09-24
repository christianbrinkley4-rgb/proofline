import { describe, expect, it } from "vitest";
import { collapseLocations, isStale, STALE_DAYS } from "./collapse";
import type { NormalizedJob } from "./types";

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
