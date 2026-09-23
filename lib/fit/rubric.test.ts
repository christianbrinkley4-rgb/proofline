import { describe, expect, it } from "vitest";
import { ELIGIBILITY_CAP, FIT_COMPONENTS, computeFit, fitBand, type FitPoints } from "./rubric";

const full: FitPoints = { requiredSkills: 30, experience: 25, education: 15, preferredSkills: 15, keywords: 10, location: 5 };

describe("FIT_COMPONENTS", () => {
  it("adds up to exactly 100", () => {
    expect(FIT_COMPONENTS.reduce((sum, c) => sum + c.max, 0)).toBe(100);
  });
});

describe("computeFit", () => {
  it("sums component points", () => {
    const points = { requiredSkills: 27, experience: 21, education: 15, preferredSkills: 10, keywords: 9, location: 5 };
    expect(computeFit(points)).toEqual({ raw: 87, score: 87, cappedBy: null });
  });

  it("clamps each component to its own range", () => {
    const points = { ...full, requiredSkills: 45, keywords: -3 };
    expect(computeFit(points).raw).toBe(90);
  });

  it("treats non-numeric points as zero", () => {
    expect(computeFit({ ...full, experience: Number.NaN }).raw).toBe(75);
  });

  it("never goes below 1", () => {
    const zero = { requiredSkills: 0, experience: 0, education: 0, preferredSkills: 0, keywords: 0, location: 0 };
    expect(computeFit(zero).score).toBe(1);
  });

  it("caps the score when an eligibility gate fails and says which gate", () => {
    const gate = { reason: "Open to 2027 graduates only", cap: ELIGIBILITY_CAP };
    expect(computeFit(full, [gate])).toEqual({ raw: 100, score: 40, cappedBy: gate });
  });

  it("uses the lowest cap when several gates fail", () => {
    const soft = { reason: "Prefers a CPA track", cap: 60 };
    const hard = { reason: "Requires work authorization you don't have", cap: 20 };
    expect(computeFit(full, [soft, hard]).cappedBy).toBe(hard);
    expect(computeFit(full, [soft, hard]).score).toBe(20);
  });

  it("reports no cap when the gate is above the raw score", () => {
    const low = { requiredSkills: 10, experience: 5, education: 5, preferredSkills: 0, keywords: 2, location: 3 };
    const result = computeFit(low, [{ reason: "Grad window", cap: ELIGIBILITY_CAP }]);
    expect(result).toEqual({ raw: 25, score: 25, cappedBy: null });
  });
});

describe("fitBand", () => {
  it.each([
    [100, "strong"],
    [80, "strong"],
    [79, "good"],
    [65, "good"],
    [64, "stretch"],
    [50, "stretch"],
    [49, "long-shot"],
    [1, "long-shot"],
  ] as const)("scores %i as %s", (score, band) => {
    expect(fitBand(score)).toBe(band);
  });
});
