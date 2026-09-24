import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import type { ResumeDocument } from "./document";
import type { Template } from "./templates";

/**
 * Lays a resume out on a US Letter page using real font metrics, so "fits on one
 * page" is measured, not guessed. The PDF renderer draws exactly these operations.
 */

export const PAGE = { width: 612, height: 792 } as const;

export type FontKey = "regular" | "bold" | "italic";

export type DrawOp =
  /** `ref` ties a line to the bullet it belongs to, for hover explanations in the preview. */
  | { kind: "text"; x: number; y: number; text: string; font: FontKey; size: number; ref?: string }
  | { kind: "rule"; x1: number; x2: number; y: number; thickness: number };

export type LayoutResult = {
  ops: DrawOp[];
  overflow: boolean;
  /** Points of space left at the bottom; negative when it overflows. */
  remaining: number;
};

type Fonts = Record<FontKey, PDFFont>;
const fontCache = new Map<string, Promise<Fonts>>();

export function loadFonts(family: Template["family"], doc?: PDFDocument): Promise<Fonts> {
  const make = async (pdf: PDFDocument): Promise<Fonts> => {
    const names =
      family === "times"
        ? { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold, italic: StandardFonts.TimesRomanItalic }
        : { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold, italic: StandardFonts.HelveticaOblique };
    const [regular, bold, italic] = await Promise.all([pdf.embedFont(names.regular), pdf.embedFont(names.bold), pdf.embedFont(names.italic)]);
    return { regular, bold, italic };
  };
  if (doc) return make(doc);
  if (!fontCache.has(family)) fontCache.set(family, PDFDocument.create().then(make));
  return fontCache.get(family)!;
}

/** Standard PDF fonts only encode WinAnsi. Map what we can and drop the rest rather than crash. */
const REPLACE: Record<string, string> = {
  "‐": "-", "‑": "-", "‒": "-", "−": "-", "→": "->", "←": "<-", "≤": "<=", "≥": ">=",
  "≈": "~", " ": " ", " ": " ", " ": " ", " ": " ", " ": " ", "★": "*", "✓": "", "✔": "",
};
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

export function sanitize(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.has(ch)) out += ch;
    else if (REPLACE[ch] !== undefined) out += REPLACE[ch];
    else {
      const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      if (base && base !== ch && [...base].every((c) => c.charCodeAt(0) < 0x7f)) out += base;
    }
  }
  return out;
}

type Segment = { text: string; font: FontKey };

function wrapSegments(segments: Segment[], maxWidth: number, size: number, fonts: Fonts): Segment[][] {
  const words: Segment[] = [];
  for (const seg of segments) {
    const parts = sanitize(seg.text).split(/(\s+)/).filter((p) => p.length);
    for (const p of parts) words.push({ text: p, font: seg.font });
  }
  const lines: Segment[][] = [];
  let line: Segment[] = [];
  let width = 0;
  for (const w of words) {
    const ww = fonts[w.font].widthOfTextAtSize(w.text, size);
    const isSpace = /^\s+$/.test(w.text);
    if (!isSpace && width + ww > maxWidth && line.length) {
      while (line.length && /^\s+$/.test(line[line.length - 1].text)) line.pop();
      lines.push(line);
      line = [];
      width = 0;
    }
    if (isSpace && !line.length) continue;
    line.push(w);
    width += ww;
  }
  while (line.length && /^\s+$/.test(line[line.length - 1].text)) line.pop();
  if (line.length) lines.push(line);
  return lines;
}

export async function layoutResume(doc: ResumeDocument, t: Template): Promise<LayoutResult> {
  const fonts = await loadFonts(t.family);
  const ops: DrawOp[] = [];
  const left = t.margin;
  const right = PAGE.width - t.margin;
  const width = right - left;
  const lh = (size: number) => size * t.lineHeight;
  let y = PAGE.height - t.margin;

  const measure = (text: string, font: FontKey, size: number) => fonts[font].widthOfTextAtSize(sanitize(text), size);

  const drawLine = (segments: Segment[][], x: number, size: number) => {
    for (const line of segments) {
      y -= lh(size);
      let cx = x;
      for (const seg of line) {
        const text = sanitize(seg.text);
        if (!/^\s+$/.test(text)) ops.push({ kind: "text", x: cx, y, text, font: seg.font, size });
        cx += fonts[seg.font].widthOfTextAtSize(text, size);
      }
    }
  };

  /** Left text and right-aligned text on one row; left wraps if it would collide. */
  const row = (leftSegs: Segment[], rightText: string | null, rightFont: FontKey, size: number) => {
    const rw = rightText ? measure(rightText, rightFont, size) + 12 : 0;
    const lines = wrapSegments(leftSegs, width - rw, size, fonts);
    const startY = y;
    drawLine(lines.length ? lines.slice(0, 1) : [[]], left, size);
    if (rightText) ops.push({ kind: "text", x: right - measure(rightText, rightFont, size), y, text: sanitize(rightText), font: rightFont, size });
    if (lines.length > 1) drawLine(lines.slice(1), left, size);
    return startY - y;
  };

  // Header
  const nameText = sanitize(doc.header.name || "Your Name");
  y -= t.nameSize;
  const nameW = measure(nameText, "bold", t.nameSize);
  ops.push({ kind: "text", x: t.headerAlign === "center" ? left + (width - nameW) / 2 : left, y, text: nameText, font: "bold", size: t.nameSize });
  y -= 3;
  if (doc.header.contact.length) {
    const contactSize = t.bodySize - 0.5;
    const joined = doc.header.contact.join("  |  ");
    const lines = wrapSegments([{ text: joined, font: "regular" }], width, contactSize, fonts);
    for (const line of lines) {
      y -= lh(contactSize);
      const text = line.map((s) => s.text).join("");
      const w = measure(text, "regular", contactSize);
      ops.push({ kind: "text", x: t.headerAlign === "center" ? left + (width - w) / 2 : left, y, text, font: "regular", size: contactSize });
    }
  }

  for (const section of doc.sections) {
    // Heading
    y -= t.headingGap;
    y -= t.headingSize;
    const heading = sanitize(t.headingUppercase ? section.title.toUpperCase() : section.title);
    ops.push({ kind: "text", x: left, y, text: heading, font: "bold", size: t.headingSize });
    if (t.headingRule) ops.push({ kind: "rule", x1: left, x2: right, y: y - 3, thickness: 0.6 });
    y -= 3;

    if (section.kind === "education") {
      for (const e of section.entries) {
        y -= 2;
        row([{ text: e.school, font: "bold" }], e.gradLine || null, "regular", t.bodySize);
        if (e.degreeLine) row([{ text: e.degreeLine, font: "italic" }], e.location, "italic", t.bodySize);
        for (const d of e.details) drawLine(wrapSegments([{ text: d, font: "regular" }], width, t.bodySize, fonts), left, t.bodySize);
      }
    } else if (section.kind === "entries") {
      for (const e of section.entries) {
        y -= 3;
        row([{ text: e.org, font: "bold" }], e.dates || null, "regular", t.bodySize);
        if (e.title || e.location) row([{ text: e.title ?? "", font: "italic" }], e.location, "italic", t.bodySize);
        for (const b of e.bullets) {
          const lines = wrapSegments([{ text: b.text, font: "regular" }], width - 14, t.bodySize, fonts);
          lines.forEach((line, i) => {
            y -= lh(t.bodySize);
            if (i === 0) ops.push({ kind: "text", x: left + 3, y, text: "•", font: "regular", size: t.bodySize, ref: b.id });
            let cx = left + 14;
            for (const seg of line) {
              const text = sanitize(seg.text);
              if (!/^\s+$/.test(text)) ops.push({ kind: "text", x: cx, y, text, font: seg.font, size: t.bodySize, ref: b.id });
              cx += fonts[seg.font].widthOfTextAtSize(text, t.bodySize);
            }
          });
        }
      }
    } else {
      y -= 2;
      for (const l of section.lines) {
        if (!l.items.length) continue;
        drawLine(wrapSegments([{ text: `${l.label}: `, font: "bold" }, { text: l.items.join(", "), font: "regular" }], width, t.bodySize, fonts), left, t.bodySize);
      }
    }
  }

  const remaining = y - t.margin;
  return { ops, overflow: remaining < 0, remaining };
}
