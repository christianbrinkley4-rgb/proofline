/**
 * Turns positioned PDF text and DOCX HTML into the plain lines the rules parser reads.
 *
 * Most student resumes put dates and places flush right on the same line as the
 * organization or title. Plain text extraction glues those together with a single
 * space ("Volunteer Tax Preparer Raleigh, NC"), which makes the columns impossible to
 * tell apart. Here a wide horizontal gap becomes three spaces, the column separator
 * the parser already understands, and a wrapped bullet is joined back into one line.
 */

export type PositionedItem = { str: string; x: number; y: number; width: number; size: number };

type Line = { items: PositionedItem[]; y: number; size: number };

const BULLET_START = /^\s*[•●▪◦■\-*–·]\s+/;
/** A gap wider than this many font sizes separates columns rather than words. */
const COLUMN_GAP = 1.2;

function groupLines(items: PositionedItem[]): Line[] {
  const sorted = items
    .filter((item) => item.str.length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const item of sorted) {
    const line = lines.find((l) => Math.abs(l.y - item.y) <= Math.max(2, l.size * 0.4));
    if (line) {
      line.items.push(item);
      line.size = Math.max(line.size, item.size);
    } else {
      lines.push({ items: [item], y: item.y, size: item.size });
    }
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines.sort((a, b) => b.y - a.y);
}

function lineText(line: Line): { text: string; columns: number } {
  let text = "";
  let columns = 1;
  let end: number | null = null;
  for (const item of line.items) {
    if (!item.str.trim()) {
      // Whitespace items only matter through the gap they leave behind.
      continue;
    }
    if (end !== null) {
      const gap = item.x - end;
      if (gap > line.size * COLUMN_GAP) {
        text = text.trimEnd() + "   ";
        columns += 1;
      } else if (gap > line.size * 0.12 && !/\s$/.test(text) && !/^\s/.test(item.str)) {
        text += " ";
      }
    }
    text += item.str;
    end = item.x + item.width;
  }
  return { text: text.replace(/\s+$/, ""), columns };
}

function firstTextX(line: Line): number {
  const visible = line.items.filter((i) => i.str.trim());
  return visible[0]?.x ?? 0;
}

/**
 * Lines of one PDF page, top to bottom. A line that is indented past the previous
 * bullet's marker, sits directly below it, and has no second column continues that bullet.
 */
export function pdfPageLines(items: PositionedItem[]): string[] {
  const out: string[] = [];
  let bullet: { index: number; markerX: number; y: number; size: number } | null = null;
  for (const line of groupLines(items)) {
    const { text, columns } = lineText(line);
    if (!text.trim()) continue;
    const x = firstTextX(line);
    const isBullet = /^\s*[•●▪◦■]/.test(text) || /^\s*[-*–·]\s+/.test(text);
    if (
      bullet &&
      !isBullet &&
      columns === 1 &&
      x > bullet.markerX + 1.5 &&
      bullet.y - line.y <= Math.max(bullet.size, line.size) * 1.8
    ) {
      out[bullet.index] = `${out[bullet.index]} ${text.trim()}`;
      bullet.y = line.y;
      continue;
    }
    out.push(text);
    bullet = isBullet ? { index: out.length - 1, markerX: x, y: line.y, size: line.size } : null;
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decode(text: string): string {
  return text
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
      if (name.startsWith("#x") || name.startsWith("#X")) return String.fromCodePoint(parseInt(name.slice(2), 16));
      if (name.startsWith("#") && name !== "#39") return String.fromCodePoint(Number(name.slice(1)));
      return ENTITIES[name.toLowerCase()] ?? whole;
    });
}

/**
 * DOCX (through mammoth's HTML) to lines. List items keep a bullet marker, which
 * plain text extraction drops, and tab stops become column gaps.
 */
export function docxHtmlLines(html: string): string[] {
  const lines: string[] = [];
  const blocks = html.match(/<(p|li|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  for (const block of blocks) {
    const tag = block.match(/^<(\w+)/)?.[1]?.toLowerCase();
    const inner = block
      .replace(/^<[^>]+>|<\/[^>]+>$/g, "")
      .replace(/<br\s*\/?>/gi, "   ")
      .replace(/<[^>]+>/g, "");
    const text = decode(inner).replace(/\t+/g, "   ").replace(/[  ]+$/g, "").replace(/^[  ]+/, "");
    if (!text.trim()) continue;
    lines.push(tag === "li" && !BULLET_START.test(text) ? `• ${text}` : text);
  }
  return lines;
}
