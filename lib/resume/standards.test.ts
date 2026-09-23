import { describe, expect, it } from "vitest";
import { repeatedOpeners, scoreBullet } from "./bullet-score";
import { draftFromStatement, withMetric } from "./rewrite";
import { suggestVerbs } from "./verbs";
import { numbersIn, verifyBullet } from "./verify";

describe("scoreBullet", () => {
  it("gives a strong X-Y-Z bullet a high score", () => {
    const { score } = scoreBullet(
      "Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments within the first quarter",
    );
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("explains every point a weak bullet loses", () => {
    const { score, checks } = scoreBullet("Responsible for helping customers.");
    expect(score).toBeLessThan(40);
    const opener = checks.find((c) => c.id === "opener")!;
    expect(opener.points).toBe(0);
    expect(opener.tip).toMatch(/Managed|Oversaw|Handled/);
    expect(checks.find((c) => c.id === "number")!.tip).toMatch(/Add a number/);
    expect(checks.find((c) => c.id === "voice")!.tip).toMatch(/period/);
  });

  it("flags pronouns, filler, and AI-sounding verbs", () => {
    const { checks } = scoreBullet("Spearheaded my team's effort to leverage Excel for 12 reports");
    expect(checks.find((c) => c.id === "clean")!.tip).toMatch(/drop I, my, and we/i);
    expect(checks.find((c) => c.id === "clean")!.tip).toMatch(/leverage/);
    expect(checks.find((c) => c.id === "voice")!.tip).toMatch(/Spearheaded/);
  });

  it("finds verbs used more than twice", () => {
    expect(repeatedOpeners(["Led a", "Led b", "Led c", "Built d"])).toEqual(["Led"]);
  });
});

describe("verifyBullet", () => {
  const facts = ["About 40 vendor accounts a month", "Found $3,200 in double payments in my first 3 months"];

  it("passes when every number is in a cited fact", () => {
    expect(verifyBullet("Reconciled 40+ vendor accounts monthly, catching $3,200 in duplicates", facts).ok).toBe(true);
  });

  it("catches a number the student never confirmed", () => {
    const result = verifyBullet("Reconciled 40+ accounts, saving 5 hours a week", facts);
    expect(result.ok).toBe(false);
    expect(result.unsupported).toEqual(["5"]);
  });

  it("accepts spelled-out numbers and ordinals from facts", () => {
    expect(verifyBullet("Placed 2nd of 18 teams", ["We came in second out of 18 teams"]).ok).toBe(true);
  });

  it("ignores years", () => {
    expect(numbersIn("Led the 2025 fall drive")).toEqual([]);
  });
});

describe("draftFromStatement", () => {
  it.each([
    ["I did the books part-time for a dental office.", "Managed the books part-time for a dental office"],
    ["Mostly paying vendors and matching statements in QuickBooks.", "Paid vendors and matched statements in QuickBooks"],
    ["I was responsible for greeting patients", "Greeted patients"],
    ["I worked on the club budget", "Contributed to the club budget"],
    ["I run the club's social media", "Ran the club's social media"],
    ["reconciling bank statements every week", "Reconciled bank statements every week"],
    ["Helped customers find textbooks", "Helped customers find textbooks"],
  ])("%j", (input, expected) => {
    expect(draftFromStatement(input)).toBe(expected);
  });

  it("adds a confirmed metric once", () => {
    const bullet = withMetric("Paid vendors and matched statements in QuickBooks", "Handled about 40 a month (Oakwood Family Dental)");
    expect(bullet).toBe("Paid vendors and matched statements in QuickBooks (about 40 a month)");
    expect(withMetric(bullet, "about 40 a month")).toBe(bullet);
  });
});

describe("suggestVerbs", () => {
  it("offers strong swaps for weak openers and skips used verbs", () => {
    expect(suggestVerbs("helped", ["Supported"])).toEqual(["Contributed to", "Assisted"]);
    expect(suggestVerbs("Reconciled")).not.toContain("Reconciled");
  });
});
