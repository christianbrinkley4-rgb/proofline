import { describe, expect, it } from "vitest";
import { documentedWorkYears } from "./candidate";

describe("documentedWorkYears", () => {
  it("counts overlapping work once and ignores projects", () => {
    expect(documentedWorkYears([
      { kind: "work", startDate: "2018-01", endDate: "2020-12" },
      { kind: "work", startDate: "2019-01", endDate: "2021-12" },
      { kind: "project", startDate: "2010-01", endDate: "2020-12" },
    ], new Date("2026-09-01"))).toBe(4);
  });
});
