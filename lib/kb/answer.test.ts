import { describe, expect, it } from "vitest";
import { isNonAnswer } from "./answer";

describe("optional evidence answers", () => {
  it("does not convert a negative or uncertain answer into a claim", () => {
    for (const value of ["no", "No improvement.", "not sure", "N/A", "I don't know", "skip"]) {
      expect(isNonAnswer(value)).toBe(true);
    }
  });
  it("keeps a concrete answer, including one that starts with no", () => {
    expect(isNonAnswer("No new software, but I reduced review time by 20%.")).toBe(false);
    expect(isNonAnswer("About 40 returns each tax season")).toBe(false);
  });
});
