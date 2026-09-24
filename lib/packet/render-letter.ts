import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { loadFonts, PAGE, sanitize } from "@/lib/resume/layout";
import type { Template } from "@/lib/resume/templates";
import type { CoverLetter } from "./cover-letter";

/**
 * A cover letter on one US Letter page, in the same fonts and header as the
 * resume template, so the two read as a set. Text-based, single column.
 */

export type LetterHeader = { name: string; contact: string[]; date: string; recipient: string[] };

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderLetterPdf(letter: CoverLetter, header: LetterHeader, template: Template): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${header.name} Cover Letter`);
  pdf.setAuthor(header.name);
  pdf.setCreator("Proofline");
  pdf.setProducer("Proofline");
  const fonts = await loadFonts(template.family, pdf);
  const margin = Math.max(template.margin, 64);
  const width = PAGE.width - margin * 2;
  // Letters read better a touch larger and looser than a dense resume.
  let size = Math.max(template.bodySize, 11);
  const ink = rgb(0.08, 0.08, 0.09);

  const blocks: Array<{ lines: string[]; font: PDFFont; size: number; gapAfter: number; align?: "center" | "left" }> = [];
  const build = () => {
    blocks.length = 0;
    const centered = template.headerAlign === "center" ? "center" : "left";
    blocks.push({ lines: [header.name], font: fonts.bold, size: template.nameSize, gapAfter: 4, align: centered });
    blocks.push({ lines: wrap(header.contact.join("  |  "), fonts.regular, size - 1, width), font: fonts.regular, size: size - 1, gapAfter: size * 1.8, align: centered });
    blocks.push({ lines: [header.date], font: fonts.regular, size, gapAfter: size });
    if (header.recipient.length) blocks.push({ lines: header.recipient, font: fonts.regular, size, gapAfter: size });
    blocks.push({ lines: [letter.greeting], font: fonts.regular, size, gapAfter: size * 0.8 });
    for (const p of letter.paragraphs) blocks.push({ lines: wrap(p.text, fonts.regular, size, width), font: fonts.regular, size, gapAfter: size * 0.8 });
    blocks.push({ lines: [letter.signoff], font: fonts.regular, size, gapAfter: size * 2.2 });
    blocks.push({ lines: [header.name], font: fonts.regular, size, gapAfter: 0 });
  };
  const height = () => blocks.reduce((sum, b) => sum + b.lines.length * b.size * 1.3 + b.gapAfter, 0);
  build();
  while (height() > PAGE.height - margin * 2 && size > 10) {
    size -= 0.5;
    build();
  }

  const page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - margin;
  for (const block of blocks) {
    for (const line of block.lines) {
      y -= block.size * 1.3;
      const text = sanitize(line);
      const x = block.align === "center" ? (PAGE.width - block.font.widthOfTextAtSize(text, block.size)) / 2 : margin;
      page.drawText(text, { x, y, size: block.size, font: block.font, color: ink });
    }
    y -= block.gapAfter;
  }
  return pdf.save();
}

export async function renderLetterDocx(letter: CoverLetter, header: LetterHeader, template: Template): Promise<Buffer> {
  const font = template.docxFont;
  const size = Math.round(Math.max(template.bodySize, 11) * 2);
  const run = (text: string, opts: { bold?: boolean; size?: number } = {}) => new TextRun({ text: sanitize(text), font, size: opts.size ?? size, bold: opts.bold });
  const align = template.headerAlign === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const para = (text: string, after = 200) => new Paragraph({ spacing: { after, line: 276 }, children: [run(text)] });
  const margin = Math.round(Math.max(template.margin, 64) * 20);
  const children = [
    new Paragraph({ alignment: align, spacing: { after: 60 }, children: [run(header.name, { bold: true, size: Math.round(template.nameSize * 2) })] }),
    new Paragraph({ alignment: align, spacing: { after: 360 }, children: [run(header.contact.join("  |  "), { size: size - 2 })] }),
    para(header.date),
    ...(header.recipient.length ? [new Paragraph({ spacing: { after: 200, line: 276 }, children: header.recipient.flatMap((r, i) => (i ? [new TextRun({ break: 1 }), run(r)] : [run(r)])) })] : []),
    para(letter.greeting, 160),
    ...letter.paragraphs.map((p) => para(p.text, 160)),
    para(letter.signoff, 480),
    para(header.name, 0),
  ];
  const doc = new Document({
    creator: "Proofline",
    title: `${header.name} Cover Letter`,
    styles: { default: { document: { run: { font, size } } } },
    sections: [{ properties: { page: { size: { width: PAGE.width * 20, height: PAGE.height * 20 }, margin: { top: margin, bottom: margin, left: margin, right: margin } } }, children }],
  });
  return Packer.toBuffer(doc);
}
