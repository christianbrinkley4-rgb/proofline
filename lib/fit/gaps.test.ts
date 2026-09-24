import { describe, expect, it } from "vitest";
import { gapId, hardGaps, skillFromAnswer, skillGaps } from "./gaps";

const detail = (missing: string[]) => ({ note: "", matched: [], missing });
const fit = {
  details: {
    requiredSkills: detail(["Journal entries", "Excel or Google Sheets"]),
    preferredSkills: detail(["NetSuite"]),
    keywords: detail(["Excel", "SQL", "Journal entries"]),
    experience: detail(["2+ years of experience requested"]),
    education: detail([]),
    location: detail([]),
  },
  gates: [{ reason: "Requires an active CPA.", cap: 40 }],
};

describe("skillGaps", () => {
  it("asks about required skills first, then nice-to-haves, then posting terms, without repeats", () => {
    const gaps = skillGaps(fit);
    expect(gaps.map((g) => [g.skill, g.kind])).toEqual([
      ["Journal entries", "required"],
      ["Excel or Google Sheets", "required"],
      ["NetSuite", "preferred"],
      ["SQL", "keyword"],
    ]);
    expect(gaps[0].question).toBe("They require journal entries. Where have you used it?");
  });

  it("skips skills the student said they haven't done", () => {
    expect(skillGaps(fit, ["journal entries", "NetSuite"]).map((g) => g.id)).toEqual(["excel-or-google-sheets", "sql"]);
  });

  it("returns nothing when every skill is covered", () => {
    expect(skillGaps({ details: { ...fit.details, requiredSkills: detail([]), preferredSkills: detail([]), keywords: detail([]) } })).toEqual([]);
  });
});

describe("hardGaps", () => {
  it("turns eligibility, years, and education into advice", () => {
    const advice = hardGaps(fit);
    expect(advice[0]).toBe("Requires an active CPA.");
    expect(advice[1]).toContain("2+ years");
  });
});

describe("skillFromAnswer", () => {
  it("records the alternative the student actually named", () => {
    expect(skillFromAnswer("Excel or Google Sheets", "I built the club budget in google sheets")).toBe("Google Sheets");
    expect(skillFromAnswer("Excel or Google Sheets", "tracked inventory every week")).toBe("Excel");
    expect(gapId("C++ / C#")).toBe("c++-c#");
  });
});
