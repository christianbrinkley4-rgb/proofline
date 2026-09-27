import { describe, expect, it } from "vitest";
import { careerActions } from "./plan";

describe("career actions", () => {
  it("supports someone who has no target role yet", () => {
    const actions = careerActions({
      targetRole: "Explore career directions",
      measure: { confirmedFacts: 0, activeBullets: 0, relevantBullets: 0, matchedRequired: null, totalRequired: null },
      hasBenchmark: false,
      missingRequired: [],
      matchedRequired: [],
    });
    expect(actions.map((action) => action.id)).toEqual(["notice-patterns", "compare-directions", "small-experiment", "choose-next-direction"]);
    expect(actions[0].detail).toContain("not choosing a career yet");
  });
  it("advances exploration after a completed experiment", () => {
    const actions = careerActions({
      targetRole: "Explore career directions",
      measure: { confirmedFacts: 0, activeBullets: 0, relevantBullets: 0, matchedRequired: null, totalRequired: null },
      hasBenchmark: false,
      missingRequired: [],
      matchedRequired: [],
      completedActionIds: new Set(["notice-patterns", "compare-directions"]),
    });
    expect(actions.map((action) => action.id)).toEqual(["small-experiment", "choose-next-direction"]);
  });
  it("gives a sparse applicant attainable first steps without inventing skills", () => {
    const actions = careerActions({
      targetRole: "Data analyst",
      measure: { confirmedFacts: 0, activeBullets: 0, relevantBullets: 0, matchedRequired: null, totalRequired: null },
      hasBenchmark: false,
      missingRequired: [],
      matchedRequired: [],
    });
    expect(actions.map((action) => action.id)).toEqual(["first-evidence", "first-bullet", "benchmark"]);
    expect(actions[0].detail).toContain("class");
  });

  it("names a missing requirement as something to verify or practice", () => {
    const actions = careerActions({
      targetRole: "Data analyst",
      measure: { confirmedFacts: 2, activeBullets: 1, relevantBullets: 0, matchedRequired: 1, totalRequired: 2 },
      hasBenchmark: true,
      missingRequired: ["SQL"],
      matchedRequired: ["Excel"],
    });
    expect(actions[0].title).toContain("SQL");
    expect(actions[0].detail).toContain("before claiming it");
    expect(actions[1].detail).toContain("Excel");
  });

  it("moves to a job-tailored document when relevant evidence exists", () => {
    const actions = careerActions({
      targetRole: "Bookkeeper",
      measure: { confirmedFacts: 5, activeBullets: 3, relevantBullets: 2, matchedRequired: 2, totalRequired: 2 },
      hasBenchmark: true,
      missingRequired: [],
      matchedRequired: ["QuickBooks"],
    });
    expect(actions).toEqual([expect.objectContaining({ id: "tailor" })]);
    const afterBuild = careerActions({
      targetRole: "Bookkeeper",
      measure: { confirmedFacts: 5, activeBullets: 3, relevantBullets: 2, matchedRequired: 2, totalRequired: 2 },
      hasBenchmark: true, benchmarkJobId: "job-123", hasTailoredResume: true,
      missingRequired: [], matchedRequired: ["QuickBooks"],
    });
    expect(afterBuild[0].title).toBe("Review your application for this posting");
    expect(afterBuild[0].href).toBe("/app/jobs/job-123");
  });
});
