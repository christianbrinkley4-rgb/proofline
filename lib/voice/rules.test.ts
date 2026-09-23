import { describe, expect, it } from "vitest";
import { findVoiceIssues, findWeakOpener } from "./rules";

describe("findVoiceIssues", () => {
  it("flags every em dash with its position", () => {
    const text = "Built it — fast — and shipped.";
    const issues = findVoiceIssues(text);
    expect(issues.filter((i) => i.rule === "em-dash").map((i) => i.index)).toEqual([9, 16]);
  });

  it("allows en dashes in date ranges", () => {
    expect(findVoiceIssues("May 2025 – Present")).toEqual([]);
  });

  it("flags banned phrases regardless of case", () => {
    const matches = findVoiceIssues("Leveraged synergies to UNLOCK growth.").map((i) => i.match.toLowerCase());
    expect(matches).toEqual(["leveraged", "synergies", "unlock"]);
  });

  it("matches hyphenated and spaced variants", () => {
    const matches = findVoiceIssues("A game-changer. A game changer. Cutting-edge tools.").map((i) => i.match.toLowerCase());
    expect(matches).toEqual(["game-changer", "game changer", "cutting-edge"]);
  });

  it("does not flag words that merely contain a banned word", () => {
    expect(findVoiceIssues("An unlockable door near the elevator.")).toEqual([]);
  });

  it("returns nothing for clean copy", () => {
    expect(findVoiceIssues("Reconciled 40+ vendor accounts each month, catching $3,200 in duplicates.")).toEqual([]);
  });
});

describe("findWeakOpener", () => {
  it.each([
    ["Ran the front desk for a campus gym", "ran"],
    ["Made flyers for club events", "made"],
    ["Sat in on client calls", "sat in"],
    ["Responsible for weekly reports", "responsible for"],
    ["helped the team close the books", "helped"],
    ["  Worked on a pricing model", "worked on"],
  ])("flags %j", (bullet, opener) => {
    expect(findWeakOpener(bullet)).toBe(opener);
  });

  it.each(["Ranked 2nd of 18 teams", "Reconciled 40+ accounts", "Madeleine Ross award winner", "Turnaround time cut by half"])(
    "accepts %j",
    (bullet) => {
      expect(findWeakOpener(bullet)).toBeNull();
    },
  );
});
