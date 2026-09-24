import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";
import { PDFDocument, rgb } from "pdf-lib";
import type { ResumeDocument } from "./document";
import { layoutResume, loadFonts, PAGE, sanitize, type LayoutResult } from "./layout";
import type { Template } from "./templates";

/**
 * The PDF draws exactly what the layout engine measured. Pass `layout` from
 * `freshChecks` (or any prior `layoutResume`) so export does not measure twice.
 */
export async function renderPdf(doc: ResumeDocument, template: Template, title: string, layout?: LayoutResult): Promise<Uint8Array> {
  const ops = (layout ?? (await layoutResume(doc, template))).ops;
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor(doc.header.name);
  pdf.setCreator("Proofline");
  pdf.setProducer("Proofline");
  const fonts = await loadFonts(template.family, pdf);
  const page = pdf.addPage([PAGE.width, PAGE.height]);
  const ink = rgb(0.08, 0.08, 0.09);
  for (const op of ops) {
    if (op.kind === "text") page.drawText(op.text, { x: op.x, y: op.y, size: op.size, font: fonts[op.font], color: ink });
    else page.drawLine({ start: { x: op.x1, y: op.y }, end: { x: op.x2, y: op.y }, thickness: op.thickness, color: rgb(0.35, 0.35, 0.37) });
  }
  return pdf.save();
}

const pt = (n: number) => Math.round(n * 2); // half-points
const twip = (points: number) => Math.round(points * 20);

/**
 * DOCX with the same content and styles. Word reflows text itself, so we match
 * fonts, sizes, margins, and spacing; the fonts are metric twins of the PDF's.
 * `layout` is accepted for call-site parity with PDF (quality gate already measured).
 */
export async function renderDocx(doc: ResumeDocument, t: Template, _layout?: LayoutResult): Promise<Buffer> {
  const contentWidth = twip(PAGE.width - 2 * t.margin);
  const font = t.docxFont;
  const size = pt(t.bodySize);
  const line = Math.round(240 * t.lineHeight * 0.96);
  const run = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) =>
    new TextRun({ text: sanitize(text), font, size: opts.size ?? size, bold: opts.bold, italics: opts.italics });
  const rightTab = [{ type: TabStopType.RIGHT, position: contentWidth }];
  const row = (leftRuns: TextRun[], rightText: string | null, rightItalic = false, before = 0) =>
    new Paragraph({
      tabStops: rightTab,
      spacing: { before, after: 0, line },
      children: rightText ? [...leftRuns, new TextRun({ text: "\t", font, size }), run(rightText, { italics: rightItalic })] : leftRuns,
    });

  const children: Paragraph[] = [
    new Paragraph({
      alignment: t.headerAlign === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [run(doc.header.name, { bold: true, size: pt(t.nameSize) })],
    }),
    new Paragraph({
      alignment: t.headerAlign === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 0 },
      children: [run(doc.header.contact.join("  |  "), { size: pt(t.bodySize - 0.5) })],
    }),
  ];

  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        spacing: { before: twip(t.headingGap + 2), after: 40 },
        border: t.headingRule ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: "595959", space: 1 } } : undefined,
        children: [run(t.headingUppercase ? section.title.toUpperCase() : section.title, { bold: true, size: pt(t.headingSize) })],
      }),
    );
    if (section.kind === "education") {
      for (const e of section.entries) {
        children.push(row([run(e.school, { bold: true })], e.gradLine || null, false, 40));
        if (e.degreeLine) children.push(row([run(e.degreeLine, { italics: true })], e.location, true));
        for (const d of e.details) children.push(new Paragraph({ spacing: { after: 0, line }, children: [run(d)] }));
      }
    } else if (section.kind === "entries") {
      for (const e of section.entries) {
        children.push(row([run(e.org, { bold: true })], e.dates || null, false, 60));
        if (e.title || e.location) children.push(row([run(e.title ?? "", { italics: true })], e.location, true));
        for (const b of e.bullets) {
          children.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 0, line }, children: [run(b.text)] }));
        }
      }
    } else {
      for (const l of section.lines) {
        if (!l.items.length) continue;
        children.push(new Paragraph({ spacing: { before: 20, after: 0, line }, children: [run(`${l.label}: `, { bold: true }), run(l.items.join(", "))] }));
      }
    }
  }

  const document = new Document({
    creator: "Proofline",
    title: `${doc.header.name} Resume`,
    styles: { default: { document: { run: { font, size } } } },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: twip(14), hanging: twip(11) } } } }],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: twip(PAGE.width), height: twip(PAGE.height) }, margin: { top: twip(t.margin), bottom: twip(t.margin), left: twip(t.margin), right: twip(t.margin) } } },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}
