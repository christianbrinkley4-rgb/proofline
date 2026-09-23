import { findDateRange } from "./dates";
import type { ParsedEducation, ParsedEntry, ParsedResume } from "./types";

/**
 * Rules-based resume parser. Works on the plain text of a PDF or DOCX, needs no
 * model, and handles the conventional one-column layouts most students use.
 * When a model is configured it gets the first try; this is the fallback and
 * the safety net.
 */

type Section = "header" | "education" | ParsedEntry["section"] | "skills" | "certifications" | "other";

const HEADINGS: Array<[RegExp, Section]> = [
  [/^(education|academic background)$/, "education"],
  [/^((work|professional|relevant|employment)\s+)?(experience|history)$/, "experience"],
  [/^(leadership|leadership (and|&) (involvement|activities)|activities|involvement|campus involvement|extracurriculars?)$/, "leadership"],
  [/^(projects?|academic projects|technical projects|selected projects)$/, "project"],
  [/^(volunteer(ing)?|volunteer experience|community service|service)$/, "volunteer"],
  [/^(research|research experience)$/, "research"],
  [/^(skills|technical skills|skills (and|&) (interests|tools)|tools|skills & certifications)$/, "skills"],
  [/^(certifications?|licenses( (and|&) certifications)?)$/, "certifications"],
  [/^(honors|awards|honors (and|&) awards|interests|references|summary|objective|profile)$/, "other"],
];

const BULLET = /^\s*[•●▪◦■\-*–·]\s+/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const LINK = /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[\w-]+|github\.com\/[\w-]+|[\w-]+\.(?:dev|io|me|com)\/?[\w/-]*)/gi;
const CITY_STATE = /\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*),\s?([A-Z]{2})\b/;
const SCHOOL = /\b(university|college|institute|school|academy)\b/i;
const DEGREE = /\b(bachelor|master|associate|doctor|b\.?\s?s\.?|b\.?\s?a\.?|m\.?\s?s\.?|m\.?\s?b\.?\s?a\.?|ph\.?\s?d\.?|b\.?\s?b\.?\s?a\.?)\b/i;
const GPA = /\bgpa[:\s]*([0-4]\.\d{1,2})|([0-4]\.\d{1,2})\s*\/\s*4\.0/i;
const GPA_TEXT = /\bgpa[:\s]*[0-4]\.\d{1,2}(?:\s*\/\s*4(?:\.0+)?)?|[0-4]\.\d{1,2}\s*\/\s*4(?:\.0+)?/gi;

function headingOf(line: string): Section | null {
  const clean = line.trim().replace(/[:|]+$/, "").toLowerCase().replace(/\s+/g, " ");
  if (clean.length > 40 || clean.split(" ").length > 5) return null;
  for (const [pattern, section] of HEADINGS) if (pattern.test(clean)) return section;
  return null;
}

/** Splits "Org | Title | City, ST | May 2025 – Present" style lines into parts. */
function splitParts(line: string): string[] {
  return line
    .split(/\s*[|•·]\s*|\s{3,}|\t+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function stripDates(text: string): string {
  const range = findDateRange(text);
  return (range ? text.replace(range.text, "") : text).replace(/[\s,|–-]+$/, "").trim();
}

function parseEntry(section: ParsedEntry["section"], header: string[], bullets: string[]): ParsedEntry {
  const joined = header.join(" | ");
  const range = findDateRange(joined);
  let location: string | null = null;
  const parts = header.flatMap(splitParts).map(stripDates).filter(Boolean);

  const withoutLocation = parts.filter((p) => {
    const m = p.match(CITY_STATE);
    if (m && p.length < 40 && !location) {
      location = `${m[1]}, ${m[2]}`;
      const rest = p.replace(m[0], "").replace(/^[\s,–-]+|[\s,–-]+$/g, "");
      return rest.length > 0;
    }
    return !(/^remote$/i.test(p) && (location = "Remote"));
  });
  const [org = header[0] ?? "Untitled", title = null] = withoutLocation.map((p) => p.replace(CITY_STATE, "").replace(/[\s,–-]+$/, "").trim());

  return {
    section,
    org,
    title,
    location,
    startDate: range?.start ?? null,
    endDate: range ? (range.current ? null : range.end) : null,
    bullets,
  };
}

function parseEducation(lines: string[]): ParsedEducation[] {
  const results: ParsedEducation[] = [];
  let current: ParsedEducation | null = null;
  for (const line of lines) {
    const text = line.replace(BULLET, "").trim();
    if (SCHOOL.test(text) && !DEGREE.test(text.split(",")[0])) {
      if (current) results.push(current);
      const range = findDateRange(text);
      current = {
        school: stripDates(text).replace(CITY_STATE, "").replace(/[\s,|–-]+$/, "").trim(),
        degree: null,
        major: null,
        minor: null,
        gradDate: range?.end ?? null,
        gpa: null,
        honors: [],
        coursework: [],
      };
      continue;
    }
    if (!current) continue;
    const gpa = text.match(GPA);
    if (gpa) current.gpa = Number(gpa[1] ?? gpa[2]);
    const range = findDateRange(text);
    if (range && !current.gradDate) current.gradDate = range.end;
    if (DEGREE.test(text) && !current.degree) {
      const body = stripDates(text).replace(GPA_TEXT, "").replace(/[,|;\s]+$/, "");
      const [degreePart, ...rest] = body.split(/\s+in\s+|,\s*/i);
      current.degree = degreePart.trim() || null;
      const majorPart = rest.join(", ").replace(/minor.*$/i, "").replace(/[\s,;|]+$/, "").trim();
      current.major = majorPart || null;
      const minor = body.match(/minor\s+in\s+([^,;|]+)/i);
      if (minor) current.minor = minor[1].trim();
    } else if (/^(relevant\s+)?coursework/i.test(text)) {
      current.coursework = text.replace(/^(relevant\s+)?coursework\s*:?\s*/i, "").split(/\s*[,;]\s*/).filter(Boolean);
    } else if (/(honors|dean's list|cum laude|scholar)/i.test(text)) {
      current.honors.push(text.replace(/^honors\s*:?\s*/i, ""));
    }
  }
  if (current) results.push(current);
  return results;
}

function parseList(lines: string[]): string[] {
  return lines
    .flatMap((l) => l.replace(BULLET, "").replace(/^[A-Za-z &]+:\s*/, "").split(/\s*[,;|]\s*/))
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 60);
}

export function parseResumeText(text: string): ParsedResume {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0);

  const buckets = new Map<Section, string[]>();
  let section: Section = "header";
  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) {
      section = heading;
      continue;
    }
    buckets.set(section, [...(buckets.get(section) ?? []), line]);
  }

  const header = buckets.get("header") ?? [];
  const headerText = header.join("  ");
  const nameLine = header.find((l) => !EMAIL.test(l) && !PHONE.test(l) && /^[A-Za-z .'-]{3,40}$/.test(l.trim()));
  const withoutEmails = headerText.replace(new RegExp(EMAIL.source, "g"), " ");
  const links = [...new Set((withoutEmails.match(LINK) ?? []).map((l) => l.replace(/^https?:\/\/(www\.)?/, "")))];

  const entries: ParsedEntry[] = [];
  for (const kind of ["experience", "leadership", "project", "volunteer", "research"] as const) {
    let headerLines: string[] = [];
    let bullets: string[] = [];
    const flush = () => {
      if (headerLines.length) entries.push(parseEntry(kind, headerLines, bullets));
      headerLines = [];
      bullets = [];
    };
    for (const line of buckets.get(kind) ?? []) {
      if (BULLET.test(line)) {
        bullets.push(line.replace(BULLET, "").trim());
      } else if (bullets.length && /^[a-z(]/.test(line.trim())) {
        // A wrapped bullet continues on the next line.
        bullets[bullets.length - 1] += ` ${line.trim()}`;
      } else {
        if (bullets.length) flush();
        if (headerLines.length >= 2) flush();
        headerLines.push(line.trim());
      }
    }
    flush();
  }

  return {
    name: nameLine?.trim() ?? null,
    email: headerText.match(EMAIL)?.[0] ?? null,
    phone: headerText.match(PHONE)?.[0] ?? null,
    location: headerText.match(CITY_STATE)?.[0] ?? null,
    links,
    education: parseEducation(buckets.get("education") ?? []),
    entries,
    skills: parseList(buckets.get("skills") ?? []),
    certifications: parseList(buckets.get("certifications") ?? []),
  };
}
