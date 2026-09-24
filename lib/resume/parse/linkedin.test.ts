import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { resumeToText } from "./index";
import { splitColumns, type PositionedItem } from "./layout-text";
import { parseResumeText } from "./rules";

/** A profile laid out like LinkedIn's "Save to PDF": a narrow sidebar and a wide main column. */
async function linkedInStylePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const draw = (text: string, x: number, y: number, size = 10, font = regular) => page.drawText(text, { x, y, size, font });

  // Sidebar
  let y = 740;
  for (const [text, isHead] of [
    ["Contact", true], ["sam.rivera@example.com", false], ["www.linkedin.com/in/sam-rivera-example", false],
    ["Top Skills", true], ["Excel", false], ["QuickBooks Online", false], ["Account Reconciliation", false],
    ["Languages", true], ["Spanish (Professional Working)", false],
  ] as const) {
    draw(text, 36, y, isHead ? 11 : 9.5, isHead ? bold : regular);
    y -= isHead ? 18 : 14;
  }

  // Main column
  y = 740;
  const main = (text: string, size = 10, font = regular, gap = 14) => {
    draw(text, 230, y, size, font);
    y -= gap;
  };
  main("Sam Rivera", 22, bold, 26);
  main("Accounting student at NC State | Bookkeeping", 11, regular, 20);
  main("Raleigh, North Carolina, United States", 9.5, regular, 26);
  main("Experience", 14, bold, 20);
  main("Oakwood Family Dental", 11, bold);
  main("Bookkeeping Assistant");
  main("May 2025 - Present (5 months)");
  main("Raleigh, North Carolina, United States");
  main("Reconciled 40 vendor accounts each month in QuickBooks Online and flagged duplicate", 9.5, regular, 12);
  main("payments for the office manager to review.", 9.5, regular, 20);
  main("NC State Bookstores", 11, bold);
  main("Inventory Assistant");
  main("August 2024 - May 2025 (10 months)");
  main("Raleigh, North Carolina, United States", 10, regular, 26);
  main("Education", 14, bold, 20);
  main("North Carolina State University", 11, bold);
  main("Bachelor of Science - BS, Accounting · (August 2024 - May 2028)");
  return pdf.save();
}

describe("two-column layouts", () => {
  it("reads a LinkedIn-style PDF one column at a time", async () => {
    const text = await resumeToText({ name: "Profile.pdf", type: "application/pdf", bytes: await linkedInStylePdf() });
    const parsed = parseResumeText(text);
    expect(parsed.email).toBe("sam.rivera@example.com");
    expect(parsed.links).toContain("linkedin.com/in/sam-rivera-example");
    expect(parsed.skills).toEqual(expect.arrayContaining(["Excel", "QuickBooks Online", "Account Reconciliation"]));
    expect(parsed.entries.map((e) => [e.org, e.title, e.location, e.startDate, e.endDate])).toEqual([
      ["Oakwood Family Dental", "Bookkeeping Assistant", "Raleigh, NC", "2025-05", null],
      ["NC State Bookstores", "Inventory Assistant", "Raleigh, NC", "2024-08", "2025-05"],
    ]);
    expect(parsed.entries[0].bullets[0]).toMatch(/^Reconciled 40 vendor accounts/);
    expect(parsed.education[0]).toMatchObject({ school: "North Carolina State University", major: "Accounting", gradDate: "2028-05" });
  }, 20_000);

  it("leaves a one-column page with flush-right dates alone", () => {
    const items: PositionedItem[] = [];
    for (let i = 0; i < 12; i++) {
      items.push({ str: `Organization number ${i} with a longer name`, x: 50, y: 700 - i * 30, width: 200, size: 10 });
      items.push({ str: "May 2025 – Present", x: 470, y: 700 - i * 30, width: 90, size: 10 });
    }
    expect(splitColumns(items)).toHaveLength(1);
  });
});
