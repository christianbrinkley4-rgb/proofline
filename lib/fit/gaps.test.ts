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
    expect(gaps[0].question).toBe("They require journal entries. Where have you used them?");
    expect(gaps[1].question).toBe("They require Excel or Google Sheets. Where have you used it?");
  });

  it("does not call a skill required when it was only inferred from job prose", () => {
    const gaps = skillGaps({ ...fit, requirementsInferred: true });
    expect(gaps[0]).toMatchObject({
      kind: "listed",
      question: "The role mentions journal entries. Have you used them anywhere?",
    });
    expect(gaps[0].why).toContain("does not clearly call it a requirement");
  });

  it("preserves a language name in a question", () => {
    const gaps = skillGaps({ details: { ...fit.details, requiredSkills: detail(["Spanish"]), preferredSkills: detail([]), keywords: detail([]) } });
    expect(gaps[0].question).toContain("Spanish");
  });

  it("skips skills the student said they haven't done", () => {
    expect(skillGaps(fit, ["journal entries", "NetSuite"]).map((g) => g.id)).toEqual(["excel-or-google-sheets", "sql"]);
  });

  it("lowercases generic tools in a sentence without lowercasing proper names", () => {
    const generic = skillGaps({ details: { ...fit.details, requiredSkills: detail(["Point-of-sale systems"]), preferredSkills: detail([]), keywords: detail([]) }, requirementsInferred: true });
    expect(generic[0].question).toBe("The role mentions point-of-sale systems. Have you used them anywhere?");
    const named = skillGaps({ details: { ...fit.details, requiredSkills: detail(["Excel"]), preferredSkills: detail([]), keywords: detail([]) }, requirementsInferred: true });
    expect(named[0].question).toContain("Excel");
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
    expect(skillFromAnswer("Excel or Google Sheets", "tracked inventory every week")).toBeNull();
    expect(skillFromAnswer("Account reconciliation", "I reconciled vendor balances monthly")).toBe("Account reconciliation");
    expect(skillFromAnswer("SQL", "I have never used SQL at work")).toBeNull();
    expect(skillFromAnswer("Excel or Google Sheets", "I never used Excel, but used Google Sheets for our club budget")).toBe("Google Sheets");
    expect(skillFromAnswer("Excel", "I never used Excel, but used Google Sheets for our club budget")).toBeNull();
    expect(skillFromAnswer("Excel", "I don't use Excel")).toBeNull();
    expect(skillFromAnswer("R", "I recorded weekly orders")).toBeNull();
    expect(gapId("C++ / C#")).toBe("c++-c#");
  });
});
