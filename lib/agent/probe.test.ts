import { describe, expect, it } from "vitest";
import { notesToStatements, probeExperience } from "./probe";

describe("probeExperience", () => {
  it("asks for the numbers a claim is missing", () => {
    const qs = probeExperience({
      org: "Oakwood Family Dental",
      notes: "I did the books part-time. Mostly paying vendors and matching statements in QuickBooks. Found some double payments once and saved the office money.",
    });
    const prompts = qs.map((q) => q.prompt).join(" | ");
    expect(prompts).toMatch(/What changed because of it/);
    expect(prompts).toMatch(/how many statements|how much money/i);
    expect(qs.length).toBeLessThanOrEqual(3);
  });

  it("asks for team size when someone led people without saying how many", () => {
    const [first] = probeExperience({ org: "Beta Alpha Psi", notes: "Led our case competition team and we placed second." });
    expect(first.prompt).toMatch(/How many were on the team/);
    expect(first.factTemplate).toBe("Led a team of {answer} people (Beta Alpha Psi)");
  });

  it("doesn't ask for a number the user already gave", () => {
    const qs = probeExperience({ org: "Campus Rec", notes: "Checked in 150 members per shift using the Fusion system in Excel." });
    expect(qs.find((q) => /how many members/i.test(q.prompt))).toBeUndefined();
  });

  it("asks about tools only when none were mentioned", () => {
    const withTools = probeExperience({ org: "A", notes: "Built a tracker in Excel." });
    const withoutTools = probeExperience({ org: "A", notes: "Helped customers at the front desk." });
    expect(withTools.some((q) => /tools or software/.test(q.prompt))).toBe(false);
    expect(withoutTools.some((q) => /tools or software/.test(q.prompt))).toBe(true);
  });

  it("orders by usefulness and respects the limit", () => {
    const qs = probeExperience(
      { org: "X", notes: "Led a team of volunteers. Reduced wait times. Handled donations and tracked orders." },
      2,
    );
    expect(qs).toHaveLength(2);
    expect(qs[0].priority).toBeGreaterThanOrEqual(qs[1].priority ?? 0);
  });
});

describe("notesToStatements", () => {
  it("splits notes into sentences and list items", () => {
    expect(notesToStatements("Did the books. Paid vendors!\n- Matched statements")).toEqual([
      "Did the books.",
      "Paid vendors!",
      "Matched statements",
    ]);
  });
});
