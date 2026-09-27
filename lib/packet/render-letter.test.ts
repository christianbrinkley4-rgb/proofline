import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { TEMPLATES } from "@/lib/resume/templates";
import type { CoverLetter } from "./cover-letter";
import { renderLetterDocx, renderLetterPdf } from "./render-letter";

const header = {
  name: "Jordan Reyes",
  contact: ["Raleigh, NC", "jordan@example.com"],
  date: "September 27, 2026",
  recipient: ["Hiring Team", "Northwind"],
};

const letter: CoverLetter = {
  greeting: "Dear Hiring Team,",
  paragraphs: [
    { purpose: "opening", sourceIds: [], text: "I am applying for the analyst role at Northwind." },
    { purpose: "evidence", sourceIds: ["b1"], text: "I reconciled invoices and tracked corrections for my team." },
    { purpose: "closing", sourceIds: [], text: "Thank you for your consideration." },
  ],
  signoff: "Sincerely,",
  generator: "offline",
  promptVersion: null,
};

describe("cover-letter exports", () => {
  it("produces valid PDF and DOCX bytes", async () => {
    const pdf = await renderLetterPdf(letter, header, TEMPLATES.classic);
    const docx = await renderLetterDocx(letter, header, TEMPLATES.classic);
    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
    expect(docx.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });

  it("keeps a long edited letter on additional pages", async () => {
    const longLetter: CoverLetter = {
      ...letter,
      paragraphs: Array.from({ length: 8 }, (_, index) => ({
        purpose: "evidence" as const,
        sourceIds: [],
        text: `Example ${index + 1}: ` + "I organized records, checked details, and shared the results with my team. ".repeat(16),
      })),
    };
    const pdf = await renderLetterPdf(longLetter, header, TEMPLATES.classic);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
  });
});
