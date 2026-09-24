import { describe, expect, it } from "vitest";
import { scoreBullet } from "./bullet-score";
import { ACTION_VERBS } from "./verbs";
import { composeXyz, gerund, resultClause } from "./xyz";

describe("gerund", () => {
  it.each([
    ["Built", "building"], ["Reconciled", "reconciling"], ["Planned", "planning"], ["Studied", "studying"],
    ["Automated", "automating"], ["Led", "leading"], ["Cut", "cutting"], ["Tracked", "tracking"], ["Oversaw", "overseeing"],
  ])("%s -> %s", (past, expected) => {
    expect(gerund(past)).toBe(expected);
  });

  it("turns every verb in the library into a real-looking -ing form", () => {
    for (const verb of Object.values(ACTION_VERBS).flat()) {
      expect(gerund(verb)).toMatch(/^[a-z]+ing$/);
      // "creatteing" or "reconcileing" would mean the stem was cut wrong; "overseeing" is fine.
      expect(gerund(verb)).not.toMatch(/(?<!e)eing$|edng$/);
    }
  });
});

describe("X-Y-Z", () => {
  it("leads with the result and its number, then the method", () => {
    const bullet = composeXyz("Built a weekly cash report from bank and QuickBooks data", "Result: saved the office manager about 3 hours a week (Oakwood)");
    expect(bullet).toBe("Saved the office manager about 3 hours a week by building a weekly cash report from bank and QuickBooks data");
    expect(scoreBullet(bullet!).score).toBeGreaterThanOrEqual(85);
  });

  it("reads results however the student phrased them", () => {
    expect(resultClause("it cut month-end counts from 2 days to 6 hours")).toBe("Cut month-end counts from 2 days to 6 hours");
    expect(resultClause("Impact (Oakwood): caught $3,200 in duplicate payments")).toBe("Caught $3,200 in duplicate payments");
    expect(resultClause("reducing errors by 30%")).toBe("Reduced errors by 30%");
    expect(resultClause("the customers were happier")).toBeNull();
  });

  it("keeps the draft when the pieces don't fit", () => {
    expect(composeXyz("Answered phones", "the customers were happier")).toBeNull();
    expect(composeXyz("Cut costs", "cut costs by 10%")).toBeNull();
  });
});
