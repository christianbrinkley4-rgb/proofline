/**
 * Writes sample resumes (PDF and DOCX) used by parser tests.
 * Run: npx tsx scripts/make-fixtures.ts
 */
import { writeFileSync } from "node:fs";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";

export const SAMPLE_LINES = [
  "Taylor Morgan",
  "Raleigh, NC | taylor.morgan@example.com | (919) 555-0188 | linkedin.com/in/taylor-morgan-example",
  "EDUCATION",
  "North Carolina State University, Raleigh, NC   Expected May 2028",
  "Bachelor of Science in Accounting   GPA: 3.62/4.0",
  "Relevant Coursework: Intermediate Accounting I, Federal Income Tax, Cost Accounting",
  "EXPERIENCE",
  "Oakwood Family Dental | Raleigh, NC",
  "Bookkeeping Assistant (part-time)   May 2025 - Present",
  "• Reconciled 40+ vendor accounts each month in QuickBooks Online",
  "• Built a weekly cash report from bank and QuickBooks data",
  "NC State Bookstores | Raleigh, NC",
  "Inventory Assistant   Aug 2024 - May 2025",
  "• Counted and tracked 300+ SKUs at month-end",
  "LEADERSHIP",
  "Beta Alpha Psi | Member   Sep 2024 - Present",
  "• Led a 5-person team to 2nd place of 18 at the regional case competition",
  "SKILLS",
  "Technical: Excel, QuickBooks Online, SQL",
];

async function main() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 740;
  for (const line of SAMPLE_LINES) {
    // WinAnsi has a bullet glyph, so this renders like a real resume export.
    page.drawText(line, { x: 54, y, size: 10.5, font });
    y -= 16;
  }
  writeFileSync("tests/fixtures/sample-resume.pdf", await pdf.save());

  const doc = new Document({
    sections: [{ children: SAMPLE_LINES.map((line) => new Paragraph({ children: [new TextRun(line)] })) }],
  });
  writeFileSync("tests/fixtures/sample-resume.docx", await Packer.toBuffer(doc));
  console.log("wrote tests/fixtures/sample-resume.pdf and .docx");
}

main();
