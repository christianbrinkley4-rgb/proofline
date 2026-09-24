import type { JobLevel, JobMode } from "./types";

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
  "&rsquo;": "'", "&lsquo;": "'", "&ldquo;": '"', "&rdquo;": '"', "&ndash;": "-", "&mdash;": "-", "&bull;": "•", "&hellip;": "...",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e);
}

/** HTML (possibly entity-encoded, as Greenhouse sends it) to readable plain text with line breaks. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  let s = html.includes("&lt;") ? decodeEntities(html) : html;
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(s)
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

export function detectMode(...texts: Array<string | null | undefined>): JobMode {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\b(remote|work from home|wfh|distributed)\b/.test(t) && !/\bnot remote\b|\bno remote\b/.test(t)) return "remote";
  if (/\b(on-?site|in[- ]office|in[- ]person)\b/.test(t)) return "onsite";
  return "unknown";
}

export function detectLevel(title: string, extra?: string | null): JobLevel {
  const t = `${title} ${extra ?? ""}`.toLowerCase();
  if (/\b(intern|internship|co-?op|summer analyst|summer associate|externship)\b/.test(t)) return "internship";
  if (/\b(new grad|new graduate|graduate program|entry[- ]level|junior|jr\.?|early career|campus|rotational|level i)\b/.test(t)) return "entry";
  // "Staff" is senior in tech (Staff Engineer) but entry level in accounting (Staff Accountant).
  if (/\bstaff (accountant|auditor|accounting|tax|assurance)\b/.test(t)) return "entry";
  if (/\b(accountant|analyst|associate|engineer|specialist|representative|coordinator) i\b(?!\w)/.test(t)) return "entry";
  if (/\b(senior|sr\.?|staff|principal|lead|manager|director|head of|vp|vice president|architect|ii\b|iii\b|iv\b)\b/.test(t)) return "experienced";
  return "unknown";
}

/** "$24 - $30/hr", "$85,000–$105,000 a year" -> numbers and period. */
export function parsePay(text: string | null | undefined): { min: number | null; max: number | null; period: "hour" | "year" | null } {
  if (!text) return { min: null, max: null, period: null };
  const m = text.match(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:-|–|to)\s*\$?\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:\/|per|an?|USD)?\s*(hour|hr|year|yr|annually|annum)?/i);
  if (!m) return { min: null, max: null, period: null };
  const num = (v: string, k?: string) => Number(v.replace(/,/g, "")) * (k ? 1000 : 1);
  const min = num(m[1], m[2]);
  const max = num(m[3], m[4]);
  const unit = m[5]?.toLowerCase();
  const period = unit ? (/h/.test(unit) ? "hour" : "year") : max < 500 ? "hour" : "year";
  return { min, max, period };
}

const TITLE_NOISE = /\b(summer|fall|spring|winter|20\d\d|remote|hybrid|onsite|intern(ship)?s?|\(.*?\)|-|–|,)\b/gi;

/** Same role posted on several boards (or twice on one) collapses to one key. */
export function dedupeKey(company: string, title: string, location: string | null): string {
  const c = company.toLowerCase().replace(/\b(inc|llc|llp|corp|corporation|company|co|group|holdings)\b\.?/g, "").replace(/[^a-z0-9]/g, "");
  const t = title.toLowerCase().replace(TITLE_NOISE, " ").replace(/[^a-z0-9]+/g, " ").trim();
  const l = (location ?? "").toLowerCase().split(/[,;|]/)[0].replace(/[^a-z]/g, "");
  return `${c}|${t}|${l}`;
}

const TERM = /\b(spring|summer|fall|autumn|winter|19\d{2}|20\d{2}|part[- ]time|full[- ]time|term[- ]time|remote|hybrid|on[- ]?site|paid|unpaid|co-?op)\b/i;

/**
 * A posting title as a person would say it: "Accounting Intern (Summer 2027)" and
 * "2027 Summer Intern - Finance Controllership" become "Accounting Intern" and
 * "Summer Intern, Finance Controllership".
 */
export function roleName(title: string): string {
  let t = title.replace(/\s*[([][^)\]]*[)\]]\s*/g, (m) => (TERM.test(m) ? " " : m)).trim();
  // Drop trailing " - Summer 2027" or " | Chicago" style qualifiers when they're only terms or places.
  t = t.replace(/\s+[-–|:]\s+([^-–|:]+)$/, (m, tail: string) => (TERM.test(tail) && tail.split(/\s+/).length <= 4 ? "" : m));
  t = t.replace(/^(?:(?:spring|summer|fall|winter)\s+)?(?:19|20)\d{2}\s+/i, "").replace(/\s+(?:19|20)\d{2}$/, "");
  t = t.replace(/\s+[-–]\s+/g, ", ").replace(/\s{2,}/g, " ").trim();
  return t || title;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
