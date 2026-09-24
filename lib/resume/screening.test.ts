import { describe, expect, it } from "vitest";
import { parseRequirements } from "@/lib/fit/requirements";
import { SAMPLE_RESUME } from "./fixtures/sample";
import { screeningReport } from "./screening";

describe("screening overlap", () => {
  it("counts only concepts visible in the actual resume and respects alternatives", () => {
    const requirements = parseRequirements("Requirements\nQuickBooks and tax preparation\nPower BI or Tableau\nPreferred\nExcel");
    const report = screeningReport(SAMPLE_RESUME, requirements);
    expect(report.totalRequired).toBeGreaterThan(0);
    expect(report.coveredRequired + report.notShown.length).toBe(report.totalRequired);
    expect(report.visibleTerms.every((term) => requirements.mentioned.includes(term))).toBe(true);
  });
  it("does not claim an unshown requirement is covered", () => {
    const doc = structuredClone(SAMPLE_RESUME);
    doc.sections = doc.sections.filter((section) => section.kind === "education");
    const report = screeningReport(doc, parseRequirements("Requirements\nTax preparation\nSQL"));
    expect(report.notShown).toContain("SQL");
  });
});
