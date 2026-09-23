const MONTHS: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03", apr: "04", april: "04",
  may: "05", jun: "06", june: "06", jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09",
  september: "09", oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
  spring: "05", summer: "08", fall: "12", autumn: "12", winter: "12",
};

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

/** One date: "May 2025", "Sept. 2024", "05/2025", "2025", "Summer 2026". */
const ONE = `(?:(?:${MONTH_NAMES})\\.?\\s+\\d{4}|\\d{1,2}\\/\\d{4}|\\d{4})`;
const PRESENT = "(?:present|current|now|today)";

/** A range like "May 2025 – Present" or "2023 - 2024", or a single "Expected May 2028". */
export const DATE_RANGE = new RegExp(`(?:expected\\s+)?(${ONE})(?:\\s*(?:-|\\u2013|\\u2014|to|through)\\s*(${ONE}|${PRESENT}))?`, "i");

/** "May 2025" -> "2025-05"; "2025" -> "2025"; "05/2025" -> "2025-05". */
export function normalizeDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/\./g, "");
  if (new RegExp(`^${PRESENT}$`).test(s)) return null;
  const slash = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[2]}-${slash[1].padStart(2, "0")}`;
  const named = s.match(/^([a-z]+)\s+(\d{4})$/);
  if (named && MONTHS[named[1]]) return `${named[2]}-${MONTHS[named[1]]}`;
  const year = s.match(/^(\d{4})$/);
  return year ? year[1] : null;
}

export type DateRange = { start: string | null; end: string | null; current: boolean; text: string };

export function findDateRange(line: string): DateRange | null {
  const m = line.match(DATE_RANGE);
  if (!m) return null;
  const [text, first, second] = m;
  const expected = /^expected/i.test(text.trim());
  if (expected || !second) {
    // A lone date on a role line is usually the end date; on education it's graduation.
    return { start: null, end: normalizeDate(first), current: false, text };
  }
  const current = new RegExp(`^${PRESENT}$`, "i").test(second.trim());
  return { start: normalizeDate(first), end: current ? null : normalizeDate(second), current, text };
}

/** "2025-05" -> "May 2025", "2025" -> "2025". For display. */
export function formatMonth(value: string | null | undefined): string {
  if (!value) return "";
  const [y, m] = value.split("-");
  if (!m) return y;
  const name = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
  return `${name} ${y}`;
}

export function formatRange(start: string | null | undefined, end: string | null | undefined): string {
  const s = formatMonth(start);
  const e = end ? formatMonth(end) : "Present";
  return s ? `${s} – ${e}` : e;
}
