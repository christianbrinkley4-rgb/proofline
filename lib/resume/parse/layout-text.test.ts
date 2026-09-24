import { describe, expect, it } from "vitest";
import { renderDocx, renderPdf } from "@/lib/resume/render";
import { SAMPLE_RESUME } from "@/lib/resume/fixtures/sample";
import { TEMPLATES } from "@/lib/resume/templates";
import { docxHtmlLines, pdfPageLines, type PositionedItem } from "./layout-text";
import { resumeToText } from "./index";
import { parseResumeText } from "./rules";

const at = (str: string, x: number, y: number, width = str.length * 5, size = 10): PositionedItem => ({ str, x, y, width, size });

describe("pdfPageLines", () => {
  it("keeps flush-right columns apart", () => {
    const lines = pdfPageLines([
      at("Volunteer Tax Preparer", 50, 600, 110),
      at(" ", 160, 600, 300),
      at("Raleigh, NC", 505, 600, 56),
    ]);
    expect(lines).toEqual(["Volunteer Tax Preparer   Raleigh, NC"]);
  });

  it("joins a wrapped bullet but not the next role", () => {
    const lines = pdfPageLines([
      at("•", 53, 600, 4),
      at("Reconciled 40+ vendor accounts each month, catching $3,200 in duplicate", 64, 600, 480),
      at("payments within the first quarter.", 64, 587, 160),
      at("Northwind Books", 50, 568, 80),
      at("May 2025 – Present", 470, 568, 92),
    ]);
    expect(lines).toEqual([
      "• Reconciled 40+ vendor accounts each month, catching $3,200 in duplicate payments within the first quarter.",
      "Northwind Books   May 2025 – Present",
    ]);
  });

  it("puts words on one line in reading order", () => {
    expect(pdfPageLines([at("World", 80, 500, 25), at("Hello", 50, 500.5, 25)])).toEqual(["Hello World"]);
  });
});

describe("docxHtmlLines", () => {
  it("marks list items as bullets and turns tabs into columns", () => {
    const html = "<p><strong>Oakwood Family Dental</strong>\tMay 2025 &ndash; Present</p><ul><li>Reconciled 40+ accounts &amp; vendors</li></ul>";
    expect(docxHtmlLines(html.replace("&ndash;", "–"))).toEqual([
      "Oakwood Family Dental   May 2025 – Present",
      "• Reconciled 40+ accounts & vendors",
    ]);
  });
});

describe("round trip", () => {
  it.each([
    ["classic PDF", async () => ({ name: "r.pdf", bytes: await renderPdf(SAMPLE_RESUME, TEMPLATES.classic, "Resume") })],
    ["technical PDF", async () => ({ name: "r.pdf", bytes: await renderPdf(SAMPLE_RESUME, TEMPLATES.technical, "Resume") })],
    ["DOCX", async () => ({ name: "r.docx", bytes: new Uint8Array(await renderDocx(SAMPLE_RESUME, TEMPLATES.technical)) })],
  ])("re-imports a %s exported by Proofline", async (_label, make) => {
    const file = await make();
    const parsed = parseResumeText(await resumeToText({ ...file, type: "" }));
    expect(parsed.name).toBe("Jordan Reyes");
    expect(parsed.education[0]).toMatchObject({ school: "North Carolina State University", degree: "Bachelor of Science", major: "Accounting", gradDate: "2028-05", gpa: 3.6 });
    expect(parsed.entries.map((e) => [e.org, e.title, e.location, e.startDate, e.endDate])).toEqual([
      ["Oakwood Family Dental", "Bookkeeping Assistant (part-time)", "Raleigh, NC", "2025-05", null],
      ["NC State VITA Program", "Volunteer Tax Preparer", "Raleigh, NC", "2026-01", "2026-04"],
      ["NC State Bookstores", "Inventory Assistant", "Raleigh, NC", "2024-08", "2025-05"],
      ["Beta Alpha Psi", "Member", null, "2024-09", null],
    ]);
    expect(parsed.entries[0].bullets[0]).toBe(
      "Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments within the first quarter.",
    );
  }, 20_000);
});
