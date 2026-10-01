import { describe, expect, it } from "vitest";
import { formatMonth } from "./month-input";

describe("the month shown in the picker", () => {
  it("names the month and year, and shows nothing for a value that is not YYYY-MM", () => {
    expect(formatMonth("2026-06")).toBe("June 2026");
    expect(formatMonth("2027-12")).toBe("December 2027");
    expect(formatMonth("")).toBe("");
    expect(formatMonth("2026-13")).toBe("");
    expect(formatMonth("2026-6")).toBe("");
    expect(formatMonth("June 2026")).toBe("");
  });
});
