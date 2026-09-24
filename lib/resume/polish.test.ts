import { describe, expect, it } from "vitest";
import { dedupeSkills, hasNumber, polishBullet, presentTenseOpener, proofread, repeatedSkills, roleEnded, toPastTense } from "./polish";

describe("toPastTense", () => {
  it.each([
    ["Manage", "Managed"],
    ["Manages", "Managed"],
    ["Managing", "Managed"],
    ["Lead", "Led"],
    ["Leading", "Led"],
    ["Build", "Built"],
    ["Reconcile", "Reconciled"],
    ["Analyze", "Analyzed"],
    ["Track", "Tracked"],
    ["Plan", "Planned"],
    ["Planning", "Planned"],
    ["Quickly", null],
    ["Identify", "Identified"],
  ])("%s -> %s", (word, past) => {
    expect(toPastTense(word)).toBe(past);
  });

  it("leaves past tense and non-verbs alone", () => {
    expect(toPastTense("Reconciled")).toBeNull();
    expect(toPastTense("Led")).toBeNull();
    expect(toPastTense("Quarterly")).toBeNull();
  });
});

describe("polishBullet", () => {
  it("fixes tense for a role that's over, and tidies spacing and case", () => {
    expect(polishBullet("reconcile  40 vendor accounts each month , in QuickBooks.", { ended: true })).toBe("Reconciled 40 vendor accounts each month, in QuickBooks");
  });

  it("keeps present tense for a current role and never changes numbers", () => {
    const text = "Manage $3,200 in monthly vendor payments";
    expect(polishBullet(text, { ended: false })).toBe(text);
    expect(polishBullet(text, { ended: true })).toBe("Managed $3,200 in monthly vendor payments");
  });
});

describe("checks", () => {
  it("reads role dates", () => {
    expect(roleEnded("May 2024 – Aug 2024")).toBe(true);
    expect(roleEnded("May 2025 – Present")).toBe(false);
    expect(roleEnded("")).toBe(false);
  });

  it("finds measures", () => {
    expect(hasNumber("Cut check-in time by 50%")).toBe(true);
    expect(hasNumber("Trained two new hires")).toBe(true);
    expect(hasNumber("Handled customer questions")).toBe(false);
  });

  it("proofreads", () => {
    expect(proofread("Posted the the weekly entries")).toEqual(['"the the" is doubled']);
    expect(proofread("led a team (of five")).toEqual(["starts with a lowercase letter", "an unclosed parenthesis"]);
    expect(proofread("Reconciled 40 accounts")).toEqual([]);
  });

  it("spots present-tense openers", () => {
    expect(presentTenseOpener("Managing the front desk")).toBe("Managing");
    expect(presentTenseOpener("Managed the front desk")).toBeNull();
  });
});

describe("skills line", () => {
  const key = (s: string) => s.replace(/\s*\(.*$/, "").toLowerCase();

  it("merges the same skill into one entry and keeps the details", () => {
    expect(dedupeSkills(["Excel (pivot tables, XLOOKUP)", "QuickBooks Online", "Excel (pivot tables, VLOOKUP)", "SQL (basic)", "SQL"], key)).toEqual([
      "Excel (pivot tables, XLOOKUP, VLOOKUP)",
      "QuickBooks Online",
      "SQL (basic)",
    ]);
  });

  it("names skills listed twice", () => {
    expect(repeatedSkills(["SQL", "Python", "SQL (basic)"], key)).toEqual(["SQL"]);
  });
});
