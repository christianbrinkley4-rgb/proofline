import { EM_DASH, EN_DASH } from "@/lib/voice/rules";
import { METROS, STATES } from "@/lib/jobs/locations";
import { findDateRange } from "./dates";
import { COLUMN_BREAK } from "./layout-text";
import type { ParsedEducation, ParsedEntry, ParsedResume } from "./types";
import { BULLET, joinWrapped } from "./bullets";
import { tidyEducation } from "./education-tidy";

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
  [/^(skills|top skills|technical skills|skills (and|&) (interests|tools)|tools|skills & certifications|languages)$/, "skills"],
  [/^(certifications?|licenses( (and|&) certifications)?)$/, "certifications"],
  [/^(honors|awards|honors[- ](and |& )?awards|interests|references|summary|objective|profile|about|publications)$/, "other"],
  // LinkedIn's PDF puts contact details in a sidebar section of their own.
  [/^contact( info(rmation)?)?$/, "header"],
];

const STATE_NAMES = Object.entries(STATES).map(([abbr, name]) => [abbr, name.toLowerCase()] as const);

/** "Raleigh, North Carolina, United States" -> "Raleigh, NC". */
function placeWithStateName(text: string): string | null {
  const m = text.trim().match(/^([A-Z][A-Za-z.' -]{1,40}),\s*([A-Za-z ]+?)(?:,\s*(?:United States|USA|US))?$/);
  if (!m) return null;
  const state = STATE_NAMES.find(([, name]) => name === m[2].trim().toLowerCase());
  return state ? `${m[1].trim()}, ${state[0]}` : null;
}

/** A header line that only carries dates, a duration, or a place ("May 2024 - Present (1 year 5 months)"). */
function isMetaLine(line: string): boolean {
  const text = line.trim().replace(/\(\s*(?:\d+\s+(?:years?|yrs?|months?|mos?)\s*)+\)/gi, "").trim();
  if (!text) return true;
  if (placeWithStateName(text)) return true;
  if (/^(remote|hybrid|on-?site)$/i.test(text)) return true;
  const rest = splitParts(text)
    .map((p) => {
      const part = stripDates(p);
      return trailingPlace(part)?.rest ?? part;
    })
    .filter(Boolean);
  return rest.length === 0;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const LINK = /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[\w-]+|github\.com\/[\w-]+|[\w-]+\.(?:dev|io|me|com)\/?[\w/-]*)/gi;
const CITY_STATE = /\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*),\s?([A-Z]{2})\b/;
const SCHOOL = /\b(university|college|institute|school|academy)\b/i;
const DEGREE = /\b(bachelor|master|associate|doctor|b\.?\s?s\.?|b\.?\s?a\.?|m\.?\s?s\.?|m\.?\s?b\.?\s?a\.?|ph\.?\s?d\.?|b\.?\s?b\.?\s?a\.?)\b/i;
const GPA = /\bgpa[:\s]*([0-4]\.\d{1,2})|([0-4]\.\d{1,2})\s*\/\s*4\.0|\b([0-4]\.\d{1,2})\s+(?:cumulative\s+)?gpa\b/i;
/** A line that opens with a degree name, so it starts a degree rather than mentioning one. */
const LEADING_DEGREE = /^(?:(?:bachelor|master|associate|doctor(?:ate)?)\b|ph\.?\s?d\b|m\.b\.a\.|mba\b|b\.b\.a\.|bba\b|[bm]\.\s?(?:s|a|sc)\.|[bm](?:s|a|sc)(?:\s+in\b|,))/i;
const GPA_TEXT = /\bgpa[:\s]*[0-4]\.\d{1,2}(?:\s*\/\s*4(?:\.0+)?)?|[0-4]\.\d{1,2}\s*\/\s*4(?:\.0+)?|\b[0-4]\.\d{1,2}\s+(?:cumulative\s+)?gpa\b/gi;

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

/** Words that end a job title, so "Tax Preparer Raleigh, NC" yields the city "Raleigh". */
const ROLE_WORD =
  /^(assistant|associate|intern|internship|analyst|manager|preparer|volunteer|member|president|vice|treasurer|secretary|director|coordinator|specialist|representative|rep|clerk|cashier|server|tutor|lead|leader|officer|chair|chairperson|captain|engineer|developer|researcher|fellow|consultant|accountant|auditor|bookkeeper|technician|advisor|adviser|mentor|ambassador|student|teacher|instructor|aide|host|hostess|barista|agent|supervisor|founder|co-founder|head|staff|worker|designer|writer|editor|scholar|trainee|apprentice|counselor|organizer|delegate|liaison|administrator|receptionist|scribe|lifeguard|coach|nanny|driver|owner|partner|university|college|school|institute|academy|program|company|inc\.?|llc|llp|group|club|society|association|chapter|team|department|office|center|centre|bank|firm|foundation|hospital|clinic|dental|store|stores|bookstore|bookstores)$/i;
/** First words of multi-word city names. */
const CITY_PREFIX =
  /^(new|san|santa|los|las|st\.?|saint|fort|ft\.?|port|mount|mt\.?|north|south|east|west|lake|palm|grand|salt|little|long|cedar|chapel|glen|el|la|del|des|baton|bowling|oklahoma|kansas|jersey|sioux|ann|colorado|corpus|silver|virginia|high|pine|myrtle|rock|round|sugar|winter|coral|boca|holly|wake|king|research|winston|ocean|daly|palo|menlo|redwood|mountain|culver|beverly|newport|huntington|overland|cherry|ellicott|chevy|falls|park|green|red|white|elk|bay|half|twin|cape|key|dana|laguna|walnut|thousand|rancho|garden|great|upper|lower|old)$/i;
const KNOWN_CITIES = new Set(METROS.flatMap((m) => m.cities));

/**
 * A trailing "City, ST" in one column of a header line, and what's left before it.
 * The city is capitalized, never a job-title or organization word, and at most three words.
 */
export function trailingPlace(part: string): { place: string; rest: string } | null {
  const text = part.trim();
  if (/^remote$/i.test(text)) return { place: "Remote", rest: "" };
  const m = text.match(/^(.*?)[\s,]*\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,4}),\s?([A-Z]{2})\.?(?:\s*\((?:remote|hybrid)\))?$/);
  if (!m || !STATES[m[3]]) return null;
  const words = m[2].split(/\s+/);
  let city: string[] = [];
  for (let i = words.length - 1; i >= 0 && city.length < 3; i--) {
    if (ROLE_WORD.test(words[i])) break;
    city = [words[i], ...city];
  }
  if (!city.length) return null;
  // Prefer a city we know; otherwise keep extra leading words only when they read like a city prefix.
  const known = [3, 2, 1].find((n) => n <= city.length && KNOWN_CITIES.has(city.slice(-n).join(" ").toLowerCase()));
  if (known) city = city.slice(-known);
  else {
    let keep = 1;
    while (keep < city.length && CITY_PREFIX.test(city[city.length - keep - 1])) keep++;
    if (!(m[1].trim() === "" && city.length === words.length)) city = city.slice(-keep);
  }
  const rest = `${m[1]} ${words.slice(0, words.length - city.length).join(" ")}`.replace(/[\s,|–-]+$/, "").trim();
  return { place: `${city.join(" ")}, ${m[3]}`, rest };
}

function parseEntry(section: ParsedEntry["section"], header: string[], bullets: string[]): ParsedEntry {
  const joined = header.join(" | ");
  const range = findDateRange(joined);
  let location: string | null = null;
  const parts = header
    .flatMap(splitParts)
    .map((p) => stripDates(p).replace(/\(\s*(?:\d+\s+(?:years?|yrs?|months?|mos?)\s*)+\)/gi, "").replace(/^\(\s*\)$/, "").trim())
    .filter(Boolean);

  const withoutLocation = parts.flatMap((p) => {
    const named = placeWithStateName(p);
    if (named) {
      location ??= named;
      return [];
    }
    const found = location ? null : trailingPlace(p);
    if (found) {
      location = found.place;
      return found.rest ? [found.rest] : [];
    }
    return [p];
  });
  const TITLE_NOUN = /\b(manager|assistant|analyst|accountant|cashier|clerk|coordinator|director|engineer|intern|receptionist|representative|specialist|supervisor|technician|server|stock(er)?|consultant|associate|lead|nurse|teacher|tutor|member|volunteer|preparer|president|treasurer|secretary|officer|founder|captain|chair|agent|advisor|adviser|bookkeeper|auditor|developer|designer|writer|editor|researcher|fellow|mentor|ambassador|instructor|aide|barista|driver|administrator|organizer|coach|trainee|apprentice|counselor|scribe|lifeguard)\b/i;
  let roleParts = withoutLocation;
  if (roleParts.length === 1) {
    const comma = roleParts[0].match(/^(.+?),\s+(.+)$/);
    if (comma && TITLE_NOUN.test(comma[2])) roleParts = [comma[1], comma[2]];
  }
  let [org = header[0] ?? "Untitled", title = null] = roleParts;
  // "Org | Title" and "Title | Org" (Proofline's own export) both occur; the role words decide.
  const ORG_NOUN = /\b(program|university|college|inc|llc|llp|company|corp|bank|group|club|society|association|department|office|stores?|dental|clinic|hospital|center|foundation|partners|chapter)\b/i;
  if (title && TITLE_NOUN.test(org) && !TITLE_NOUN.test(title)) [org, title] = [title, org];
  else if (title && ORG_NOUN.test(title) && !ORG_NOUN.test(org)) [org, title] = [title, org];

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

/** A column that is already a school, degree, date, GPA, honor, course, or place. */
function classifiedEducationPart(part: string): boolean {
  const text = part.trim();
  if (!text) return true;
  if (SCHOOL.test(text) || DEGREE.test(text)) return true;
  if (/(honors|dean's list|cum laude|scholar)/i.test(text)) return true;
  if (/^(relevant\s+)?coursework\b/i.test(text)) return true;
  if (/^minor\b/i.test(text)) return true;
  if (GPA.test(text)) return true;
  const dated = findDateRange(text);
  if (dated && !stripDates(text).replace(/^expected\b/i, "").trim()) return true;
  if (placeWithStateName(text)) return true;
  const place = trailingPlace(text);
  if (place && !place.rest) return true;
  return false;
}

/** Education text that isn't a school, degree, date, GPA, honor, or course. "CPA candidate" stays. */
function educationDetailLines(text: string): string[] {
  const parts = splitParts(text);
  const source = parts.length > 1 ? parts : [text];
  const details: string[] = [];
  for (const raw of source) {
    const cleaned = stripDates(raw)
      .replace(/\bgpa[:\s]*[0-4]\.\d{1,2}(?:\s*\/\s*4(?:\.0+)?)?|[0-4]\.\d{1,2}\s*\/\s*4(?:\.0+)?|\b[0-4]\.\d{1,2}\s+(?:cumulative\s+)?gpa\b/gi, "")
      .replace(/[,|;\s]+$/g, "")
      .trim();
    if (cleaned.length < 2 || classifiedEducationPart(cleaned) || classifiedEducationPart(raw)) continue;
    if (!details.some((line) => line.toLowerCase() === cleaned.toLowerCase())) details.push(cleaned);
  }
  return details;
}

function parseEducation(lines: string[]): ParsedEducation[] {
  const results: ParsedEducation[] = [];
  let current: ParsedEducation | null = null;
  let inCoursework = false;
  const pending: string[] = [];
  const pushDetail = (entry: ParsedEducation, line: string) => {
    if (!entry.details.some((d) => d.toLowerCase() === line.toLowerCase())) entry.details.push(line);
  };
  const startEntry = (entry: Omit<ParsedEducation, "details">, fromLine: string): ParsedEducation => {
    const details = pending.splice(0, pending.length);
    for (const line of educationDetailLines(fromLine)) {
      if (!details.some((d) => d.toLowerCase() === line.toLowerCase())) details.push(line);
    }
    return { ...entry, details };
  };
  for (const line of lines) {
    const text = line.replace(BULLET, "").trim();
    // Coursework that wraps: "…, Cost" then "Accounting, Corporate Finance".
    // A line of its own, such as "CPA candidate", is not more coursework.
    if (inCoursework && current && !SCHOOL.test(text) && !DEGREE.test(text) && !/:/.test(text) && !/(honors|dean's list|cum laude|scholar|gpa)/i.test(text)) {
      const notes = educationDetailLines(text);
      const continuesList = /^[a-z(]/.test(text) || /[,;]/.test(text);
      if (!continuesList && notes.length) {
        inCoursework = false;
        for (const note of notes) pushDetail(current, note);
        continue;
      }
      const [first = "", ...more] = splitList(text).map((s) => s.trim()).filter(Boolean);
      const last = current.coursework.length - 1;
      if (last >= 0) current.coursework[last] = `${current.coursework[last]} ${first}`.trim();
      else current.coursework.push(first);
      current.coursework.push(...more);
      continue;
    }
    inCoursework = false;
    // Degree first, then the school: "Master of Science in Accounting, UNC Greensboro | January 2027 to June 2027".
    // Both must sit in the first column, so "Bachelor of Science   Raleigh, NC" (a campus column) doesn't count.
    const firstColumn = splitParts(text)[0] ?? "";
    const degreeAndSchool = firstColumn.match(/^([^,]+),\s*(.+)$/);
    const lead = degreeAndSchool?.[1].trim() ?? "";
    const afterDegree = degreeAndSchool && DEGREE.test(lead) && !SCHOOL.test(lead) ? degreeAndSchool[2].trim() : undefined;
    const isPlace = afterDegree ? trailingPlace(afterDegree)?.rest === "" || Boolean(placeWithStateName(afterDegree)) : false;
    if (afterDegree && !isPlace && (SCHOOL.test(afterDegree) || /^[A-Z]{2,}\b/.test(afterDegree)) && !/^(minor|major|concentration|with|gpa)\b/i.test(afterDegree)) {
      if (current) results.push(current);
      const range = findDateRange(text);
      current = startEntry({
        school: stripDates(afterDegree).replace(CITY_STATE, "").replace(/[\s,|–-]+$/, "").trim(),
        degree: null,
        major: null,
        minor: null,
        gradDate: range?.end ?? null,
        gpa: null,
        honors: splitParts(text).filter((p) => /(honors|dean's list|cum laude|scholar)/i.test(p)),
        coursework: [],
      }, text);
      const gpa = text.match(GPA);
      if (gpa) current.gpa = Number(gpa[1] ?? gpa[2] ?? gpa[3]);
      const [degreePart, ...majorParts] = lead.split(/\s+in\s+/i);
      current.degree = degreePart.trim() || null;
      current.major = majorParts.join(" in ").trim() || null;
      continue;
    }
    // Columns without dates or the campus location: "Bachelor of Science in Accounting   Raleigh, NC".
    const clean = splitParts(text)
      .map((p) => {
        // LinkedIn wraps dates in parentheses: "(August 2024 - May 2028)".
        const part = stripDates(p).replace(/\(\s*\)/g, "").trim();
        return trailingPlace(part)?.rest ?? part;
      })
      .filter(Boolean)
      .join(", ");
    let detailText = text;
    let detailClean = clean;
    // "UNC Greensboro - Bachelor of Science, Accounting" or the degree first, split by a hyphen, en dash, or em dash.
    const dashed = firstColumn.split(EM_DASH).join("-").split(EN_DASH).join("-").match(/^([^\d].*?)\s+-\s+([^\d].*)$/);
    const dashedDegree = dashed ? (DEGREE.test(dashed[2]) && !DEGREE.test(dashed[1]) ? 2 : DEGREE.test(dashed[1]) && !DEGREE.test(dashed[2]) ? 1 : 0) : 0;
    if (dashed && dashedDegree) {
      if (current) results.push(current);
      const schoolPart = dashed[dashedDegree === 2 ? 1 : 2];
      const degreePart = dashed[dashedDegree];
      const range = findDateRange(text);
      current = startEntry({
        school: stripDates(schoolPart).replace(CITY_STATE, "").replace(/[\s,|–-]+$/, "").trim(),
        degree: null,
        major: null,
        minor: null,
        gradDate: range?.end ?? null,
        gpa: null,
        honors: splitParts(text).filter((p) => /(honors|dean's list|cum laude|scholar)/i.test(p)),
        coursework: [],
      }, "");
      detailText = [degreePart, ...splitParts(text).slice(1)].join(" | ");
      detailClean = stripDates(degreePart).trim();
    } else if (current?.degree && LEADING_DEGREE.test(text) && !SCHOOL.test(text)) {
      // A second degree under the same school heading: "Bachelor of Science in Accounting" after the Master's.
      results.push(current);
      const range = findDateRange(text);
      current = { school: current.school, degree: null, major: null, minor: null, gradDate: range?.end ?? null, gpa: null, honors: [], coursework: [], details: [] };
    } else if (SCHOOL.test(text) && !DEGREE.test(text.split(",")[0])) {
      if (current) results.push(current);
      const degreeBreak = text.match(new RegExp(",\\s*(?=" + DEGREE.source + ")", "i"));
      const inline = degreeBreak?.index != null ? text.slice(degreeBreak.index + degreeBreak[0].length).trim() : "";
      const hasInlineDegree = Boolean(inline);
      const schoolLine = hasInlineDegree ? text.slice(0, degreeBreak!.index) : text;
      const range = findDateRange(text);
      current = startEntry({
        school: (hasInlineDegree ? schoolLine : clean).replace(CITY_STATE, "").replace(/[\s,|–-]+$/, "").trim(),
        degree: null,
        major: null,
        minor: null,
        gradDate: range?.end ?? null,
        gpa: null,
        honors: [],
        coursework: [],
      }, text);
      if (!hasInlineDegree) continue;
      detailText = inline;
      detailClean = stripDates(inline).trim();
    }
    if (!current) {
      pending.push(...educationDetailLines(text));
      continue;
    }
    const gpa = detailText.match(GPA);
    if (gpa) current.gpa = Number(gpa[1] ?? gpa[2] ?? gpa[3]);
    const range = findDateRange(detailText);
    if (range && !current.gradDate) current.gradDate = range.end;
    if (DEGREE.test(detailText) && !current.degree) {
      const body = detailClean.replace(GPA_TEXT, "").replace(/[,|;\s]+$/, "").replace(/,\s*,/g, ",");
      const applied = body.match(/^(Associate (?:in|of) Applied Science)(?:,\s*([^,]+))?/i);
      const abbreviated = body.match(/^((?:[BMA]\.?(?:\s?[SAB]\.?)?(?:\s?[AS]\.?)?|Ph\.?\s?D\.?))\s+(?!in\b)([^,]+)/i);
      const [degreePart, ...rest] = applied ? [applied[1], applied[2] ?? ""] : abbreviated ? [abbreviated[1], abbreviated[2]] : body.split(/\s+in\s+|,\s*/i);
      current.degree = degreePart.trim().replace(/\s+-\s+[A-Z][A-Za-z.]{1,5}$/, "") || null;
      const majorPart = rest.join(", ").replace(/,?\s*minor.*$/i, "").replace(/[\s,;|]+$/, "").trim();
      current.major = majorPart || null;
      const minor = body.match(/minor\s+in\s+([^,;|]+)/i);
      if (minor) current.minor = minor[1].trim();
    } else if (/^(relevant\s+)?coursework/i.test(text)) {
      current.coursework = splitList(text.replace(/^(relevant\s+)?coursework\s*:?\s*/i, "")).map((s) => s.trim()).filter(Boolean);
      inCoursework = true;
    } else if (/(honors|dean's list|cum laude|scholar)/i.test(text)) {
      // "GPA: 3.69 | Dean's List": the GPA is read above; only the honor is an honor.
      const parts = splitParts(text.replace(/^honors\s*:?\s*/i, ""));
      const honors = parts.length > 1 ? parts.filter((p) => /(honors|dean's list|cum laude|scholar)/i.test(p)) : parts;
      for (const honor of honors) if (!current.honors.some((h) => h.toLowerCase() === honor.toLowerCase())) current.honors.push(honor);
    } else {
      for (const note of educationDetailLines(detailText)) pushDetail(current, note);
    }
  }
  if (current) {
    for (const note of pending.splice(0)) pushDetail(current, note);
    results.push(current);
  } else if (results.length) {
    for (const note of pending) pushDetail(results[results.length - 1], note);
  }
  return results;
}

/** A line that stops mid-phrase ("…conversions across", "…in QuickBooks,"), so a number on the next line continues it. */
const MID_PHRASE = /(,|\b(across|and|or|of|to|for|in|on|at|by|with|from|over|than|about|per|the|a|an|into|through|while|including|between))$/i;

function looksLikeSentence(line: string): boolean {
  const text = line.trim();
  const range = findDateRange(text);
  if ((range && text.endsWith(range.text.trim())) || splitParts(text).length > 1) return false;
  return text.split(/\s+/).length >= 8 && (/[.;]$/.test(text) || /^[A-Z][a-z]+ed\b/.test(text));
}

/** Splits on commas, semicolons, and bars, but not inside parentheses: "Excel (pivot tables, XLOOKUP)" stays whole. */
function splitList(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    if ((ch === ")" || ch === "]") && depth > 0) depth--;
    if (depth === 0 && /[,;|•]/.test(ch)) {
      items.push(current);
      current = "";
    } else current += ch;
  }
  items.push(current);
  return items;
}

/**
 * A Skills section often carries labeled lines: "Technical: ...", "Licenses: ...",
 * "Interests: ...". Licenses and certifications go with certifications; interests
 * aren't skills, so they're left out. Unlabeled lines are skills.
 */
function splitSkillLabels(lines: string[]): { skills: string[]; licenses: string[] } {
  const skills: string[] = [];
  const licenses: string[] = [];
  for (const line of lines) {
    const label = line.replace(BULLET, "").match(/^\s*([A-Za-z &/]+):\s*/)?.[1].trim().toLowerCase() ?? "";
    if (/^(interests?|hobbies|activities)$/.test(label)) continue;
    if (/licen[cs]es?|certifications?|certificates?|credentials?/.test(label)) licenses.push(line);
    else skills.push(line);
  }
  return { skills: parseList(skills), licenses };
}

function parseCertifications(lines: string[]): string[] {
  const merged: string[] = [];
  for (const item of parseList(lines)) {
    if (/^(?:19|20)\d{2}$/.test(item)) {
      if (merged.length) merged[merged.length - 1] += `, ${item}`;
    } else merged.push(item);
  }
  return merged;
}
function parseList(lines: string[]): string[] {
  return lines
    .flatMap((l) => splitList(l.replace(BULLET, "").replace(/^[A-Za-z &]+:\s*/, "")))
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
    if (line.trim() === COLUMN_BREAK) {
      // A new column starts with no section until it names one; its opening lines are header material.
      section = "header";
      continue;
    }
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
  const links = [...new Set((withoutEmails.match(LINK) ?? []).map((l) => l.replace(/^https?:\/\//, "").replace(/^www\./, "")))];

  const skillLines = splitSkillLabels(buckets.get("skills") ?? []);
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
      } else if (bullets.length && /^[\d$]/.test(line.trim()) && MID_PHRASE.test(bullets[bullets.length - 1])) {
        // "…Roth conversions across" then "25+ appointments…": the number finishes the line above.
        bullets[bullets.length - 1] = joinWrapped(bullets[bullets.length - 1], line.trim());
      } else if (headerLines.length && looksLikeSentence(line)) {
        // Some exports drop the bullet marker; a full sentence under a role is still a bullet.
        bullets.push(line.trim());
      } else if (bullets.length && /^[a-z(]/.test(line.trim())) {
        // A wrapped bullet continues on the next line; a word broken at a hyphen rejoins without a space.
        bullets[bullets.length - 1] = joinWrapped(bullets[bullets.length - 1], line.trim());
      } else if (headerLines.length && !bullets.length && isMetaLine(line)) {
        // Dates or a place on their own line still describe the role above.
        headerLines.push(line.trim());
      } else {
        if (bullets.length) flush();
        if (headerLines.filter((l) => !isMetaLine(l)).length >= 2) flush();
        headerLines.push(line.trim());
      }
    }
    flush();
  }

  return {
    name: nameLine?.trim() ?? null,
    email: headerText.match(EMAIL)?.[0] ?? null,
    phone: headerText.match(PHONE)?.[0] ?? null,
    location: headerText.match(CITY_STATE)?.[0] ?? header.map(placeWithStateName).find(Boolean) ?? null,
    links,
    education: tidyEducation(parseEducation(buckets.get("education") ?? [])),
    entries,
    skills: skillLines.skills,
    certifications: parseCertifications([...(buckets.get("certifications") ?? []), ...skillLines.licenses]),
  };
}
