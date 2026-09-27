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

  it("does not credit a school or job title as skill evidence", () => {
    const doc = structuredClone(SAMPLE_RESUME);
    doc.sections = [{
      kind: "entries", title: "Experience", entries: [{
        experienceId: "one", org: "SQL Solutions", title: "SQL Analyst", location: null, dates: "",
        bullets: [{ id: "one", text: "Handled customer questions", factIds: ["fact-one"] }],
      }],
    }];
    const report = screeningReport(doc, parseRequirements("Requirements\nSQL"));
    expect(report.requiredEvidence).toContainEqual({ label: "SQL", status: "missing", evidence: null });
    expect(report.coveredRequired).toBe(0);
  });

  it("separates a visible example from a skill list and confirmed profile evidence", () => {
    const doc = structuredClone(SAMPLE_RESUME);
    doc.sections = [
      { kind: "entries", title: "Experience", entries: [{
        experienceId: "one", org: "Acme", title: "Assistant", location: null, dates: "",
        bullets: [{ id: "one", text: "Built weekly reports in Excel", factIds: ["fact-one"] }],
      }] },
      { kind: "skills", title: "Skills", lines: [{ label: "Technical", items: ["SQL"] }] },
    ];
    const report = screeningReport(
      doc,
      parseRequirements("Requirements\nExcel\nSQL\nQuickBooks\nTableau"),
      ["Used QuickBooks for monthly bookkeeping"],
    );
    expect(report.requiredEvidence).toEqual([
      { label: "Excel", status: "example", evidence: "Built weekly reports in Excel" },
      { label: "SQL", status: "listed", evidence: "SQL" },
      { label: "QuickBooks", status: "profile", evidence: "Used QuickBooks for monthly bookkeeping" },
      { label: "Tableau", status: "missing", evidence: null },
    ]);
    expect(report.coveredRequired).toBe(2);
    expect(report.notShown).toEqual(["QuickBooks", "Tableau"]);
  });

  it("does not present a negated profile mention as confirmed skill evidence", () => {
    const doc = structuredClone(SAMPLE_RESUME);
    doc.sections = [];
    const report = screeningReport(doc, parseRequirements("Requirements\nSQL"), ["I have no experience with SQL"]);
    expect(report.requiredEvidence[0].status).toBe("missing");
  });
});
