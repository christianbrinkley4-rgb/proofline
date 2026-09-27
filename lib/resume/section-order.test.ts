import { describe, expect, it } from "vitest";
import { educationAfterExperience } from "./section-order";

const today = new Date("2026-09-26T00:00:00Z");

describe("education order", () => {
  it("puts work first for a long-established specialist", () => {
    expect(educationAfterExperience("2013-05", [{ kind: "work", startDate: "2014-04", endDate: null }], today)).toBe(true);
  });
  it("keeps education first for a current student, even with earlier work", () => {
    expect(educationAfterExperience("2027-05", [{ kind: "work", startDate: "2019-03", endDate: null }], today)).toBe(false);
  });
  it("keeps education first with short or undocumented work history", () => {
    expect(educationAfterExperience(null, [{ kind: "work", startDate: "2024-03", endDate: null }], today)).toBe(false);
    expect(educationAfterExperience(null, [{ kind: "work", startDate: null, endDate: null }], today)).toBe(false);
  });
});
