import { describe, expect, it } from "vitest";
import { describeIntent, parseIntent } from "./intent";
import { matchesPlace, resolvePlace } from "./locations";
import { dedupeKey, detectLevel, detectMode, htmlToText, parsePay } from "./text";

describe("parseIntent", () => {
  it("reads the brief's example query", () => {
    const intent = parseIntent("find accounting internships in Raleigh for summer 2027, remote-friendly");
    expect(intent).toMatchObject({
      roles: ["accounting"],
      level: "internship",
      term: "Summer 2027",
      locations: ["Raleigh"],
      exclude: [],
    });
    expect(intent.modes.sort()).toEqual(["hybrid", "remote"]);
  });

  it("reads exclusions like 'don't require the CPA yet'", () => {
    const intent = parseIntent("find entry-level finance roles that don't require the CPA yet");
    expect(intent.level).toBe("entry");
    expect(intent.roles).toEqual(["finance"]);
    expect(intent.exclude).toEqual(["cpa"]);
  });

  it("reads city and state, pay floors, and 'not' exclusions", () => {
    const intent = parseIntent("tax intern near Charlotte, NC paying at least $22/hr not sales");
    expect(intent.locations).toEqual(["Charlotte, NC"]);
    expect(intent.payFloor).toEqual({ amount: 22, period: "hour" });
    expect(intent.exclude).toEqual(["sales"]);
    expect(intent.roles).toEqual(["tax"]);
  });

  it.each([
    "audit and accounting internships, remote or anywhere in the US",
    "accounting internships anywhere",
    "accounting internships, remote or in person",
    "accounting internships nationwide",
  ])("lifts place and setup limits for %s", (query) => {
    const intent = parseIntent(query, { targetLocations: ["Durham, NC"], workModes: ["hybrid"] });
    expect(intent.locations).toEqual([]);
    expect(intent.modes).toEqual([]);
    expect(intent.level).toBe("internship");
    expect(intent.roles).toContain("accounting");
  });

  it("falls back to the profile when the query leaves things out", () => {
    const intent = parseIntent("anything good this week", {
      targetRoles: ["Audit intern"],
      targetLocations: ["Durham, NC", "Remote"],
      workModes: ["hybrid"],
      targetTerm: "Summer 2027",
    });
    expect(intent.roles).toEqual(["audit"]);
    expect(intent.level).toBe("internship");
    expect(intent.locations).toEqual(["Durham, NC"]);
    expect(intent.modes).toEqual(["hybrid"]);
    expect(intent.term).toBe("Summer 2027");
  });

  it("describes intent as short chips", () => {
    const chips = describeIntent(parseIntent("remote data analyst internships"));
    expect(chips).toEqual(expect.arrayContaining([{ label: "Level", value: "Internship" }, { label: "Mode", value: "Remote" }]));
  });
});

describe("places", () => {
  it("expands a city into its metro", () => {
    const raleigh = resolvePlace("Raleigh, NC")!;
    expect(raleigh.label).toBe("Raleigh area");
    expect(matchesPlace("Durham, North Carolina", raleigh)).toBe(true);
    expect(matchesPlace("Morrisville, NC", raleigh)).toBe(true);
    expect(matchesPlace("Charlotte, NC", raleigh)).toBe(false);
  });

  it("matches a whole state", () => {
    const nc = resolvePlace("North Carolina")!;
    expect(matchesPlace("Charlotte, NC", nc)).toBe(true);
    expect(matchesPlace("Austin, TX", nc)).toBe(false);
  });
});

describe("posting text helpers", () => {
  it("decodes Greenhouse's entity-encoded HTML", () => {
    expect(htmlToText("&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Excel&lt;/li&gt;&lt;/ul&gt;")).toBe("Hello & welcome\n\n• Excel");
  });

  it("detects mode and level", () => {
    expect(detectMode("Raleigh, NC (Hybrid)")).toBe("hybrid");
    expect(detectMode("Remote - US")).toBe("remote");
    expect(detectLevel("Audit Intern, Summer 2027")).toBe("internship");
    expect(detectLevel("Staff Accountant I")).toBe("entry");
    expect(detectLevel("Senior Revenue Accountant")).toBe("experienced");
  });

  it("parses pay ranges", () => {
    expect(parsePay("$24 - $30/hr")).toEqual({ min: 24, max: 30, period: "hour" });
    expect(parsePay("$85,000 – $105,000 a year")).toEqual({ min: 85000, max: 105000, period: "year" });
  });

  it("collapses the same role across boards", () => {
    expect(dedupeKey("Stripe, Inc.", "Accounting Intern (Summer 2027)", "Chicago, IL")).toBe(
      dedupeKey("Stripe", "Accounting Intern - Summer 2027", "Chicago, Illinois, United States"),
    );
  });
});

describe("role exclusions", () => {
  it("keeps Quality Assurance engineers out of accounting searches", async () => {
    const { titleExcluded } = await import("./roles");
    expect(titleExcluded("2027 Internship - Quality Assurance Engineer", ["accounting"])).toBe(true);
    expect(titleExcluded("Audit & Assurance Intern", ["accounting"])).toBe(false);
    expect(titleExcluded("Aquatics Accounting Intern", ["accounting"])).toBe(false);
  });
});
