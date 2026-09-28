import { describe, expect, it } from "vitest";
import { dedupeSkills, hasNumber, polishBullet, presentTenseOpener, proofread, repeatedSkills, roleEnded, toPastTense, toPresentTense } from "./polish";
import { ACTION_VERBS } from "./verbs";

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
    ["Exceed", "Exceeded"],
  ])("%s -> %s", (word, past) => {
    expect(toPastTense(word)).toBe(past);
  });

  it("leaves past tense and non-verbs alone", () => {
    expect(toPastTense("Reconciled")).toBeNull();
    expect(toPastTense("Led")).toBeNull();
    expect(toPastTense("Quarterly")).toBeNull();
    expect(toPastTense("Found")).toBeNull();
  });
});

describe("toPresentTense", () => {
  it("maps every action verb onto one present form", () => {
    const seen = new Set<string>();
    for (const verb of Object.values(ACTION_VERBS).flat()) {
      if (seen.has(verb)) continue;
      seen.add(verb);
      const present = toPresentTense(verb);
      if (present === null) {
        expect(["Read", "Cut", "Set", "Put"]).toContain(verb);
        continue;
      }
      if (verb === "Founded") expect(present).toBe("Found");
      else expect(toPastTense(present), verb).toBe(verb);
    }
  });

  it("leaves a present opener and a non-verb alone", () => {
    expect(toPresentTense("Manage")).toBeNull();
    expect(toPresentTense("Architect")).toBeNull();
    expect(toPresentTense("Quarterly")).toBeNull();
    expect(toPresentTense("Drove")).toBe("Drive");
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

  it("uses one tense for every line in an entry", () => {
    const lines = [
      "Architect the billing flow for 12 clients",
      "Track vendor payments each week",
      "Drove 40 demo bookings",
      "Booked 15 client meetings",
      "Built the tracker in Sheets",
    ];
    expect(lines.map((line) => polishBullet(line, { ended: true }))).toEqual([
      "Architected the billing flow for 12 clients",
      "Tracked vendor payments each week",
      "Drove 40 demo bookings",
      "Booked 15 client meetings",
      "Built the tracker in Sheets",
    ]);
    expect(lines.map((line) => polishBullet(line, { ended: false }))).toEqual([
      "Architect the billing flow for 12 clients",
      "Track vendor payments each week",
      "Drive 40 demo bookings",
      "Book 15 client meetings",
      "Build the tracker in Sheets",
    ]);
  });
});

describe("checks", () => {
  it("reads role dates", () => {
    expect(roleEnded("May 2024 – Aug 2024")).toBe(true);
    expect(roleEnded("May 2025 – Present")).toBe(false);
    expect(roleEnded("Current")).toBe(false);
    expect(roleEnded("")).toBe(true);
    expect(roleEnded("   ")).toBe(true);
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
