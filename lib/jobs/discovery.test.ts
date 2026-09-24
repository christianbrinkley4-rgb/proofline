import { describe, expect, it } from "vitest";
import { boardFromSavedJob, uniqueDiscoveredBoards } from "./discovery";
import type { JobSource } from "./types";

const seed = (source: JobSource, sourceId: string, company = "Example") => ({ source, sourceId, company });

describe("board discovery from saved jobs", () => {
  it("accepts a verified ATS source and its board slug", () => {
    expect(boardFromSavedJob(seed("greenhouse", "newcompany:12345", "New Company")))
      .toEqual({ source: "greenhouse", slug: "newcompany", company: "New Company" });
    expect(boardFromSavedJob(seed("lever", "anotherco:4bd960d7-9380-4830-8605-02a04baa48b4"))?.slug).toBe("anotherco");
  });

  it("rejects generic links and malformed slugs", () => {
    expect(boardFromSavedJob(seed("link", "newcompany:12345"))).toBeNull();
    expect(boardFromSavedJob(seed("greenhouse", "../../other:12345"))).toBeNull();
    expect(boardFromSavedJob(seed("ashby", "newcompany:"))).toBeNull();
    expect(boardFromSavedJob(seed("workday", "newcompany:12345"))).toBeNull();
  });

  it("deduplicates known and discovered boards case-insensitively and caps additions", () => {
    const jobs = [
      seed("greenhouse", "STRIPE:123"),
      seed("ashby", "NewCompany:a1"),
      seed("ashby", "newcompany:a2"),
      seed("lever", "second:b1"),
      seed("greenhouse", "third:c1"),
    ];
    expect(uniqueDiscoveredBoards(jobs, [{ source: "greenhouse", slug: "stripe", company: "Stripe" }], 2))
      .toEqual([
        { source: "ashby", slug: "NewCompany", company: "Example" },
        { source: "lever", slug: "second", company: "Example" },
      ]);
    expect(uniqueDiscoveredBoards(jobs, [], 0)).toEqual([]);
  });
});
