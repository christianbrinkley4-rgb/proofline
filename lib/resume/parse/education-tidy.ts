import type { ParsedEducation } from "./types";

/**
 * Cleans up the schools read from a resume, whichever reader produced them, so
 * the import never offers the same school twice:
 * - a university line followed by one of its schools or colleges ("Bryan School
 *   of Business and Economics") is one entry under the university's name;
 * - the same school and degree listed twice (a header, then details) is one
 *   entry with every honor, course, and detail from both.
 * Two different degrees at one school stay two entries.
 */

const norm = (value: string | null | undefined) =>
  (value ?? "").toLowerCase().replace(/&/g, " and ").replace(/\./g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** A school inside a university: "School of Nursing", "Bryan School of Business", "Honors College", "Kenan-Flagler Business School". */
const SUB_UNIT = /\b(school|college|faculty|division|department) of\b|\b(business|law|medical|graduate|honors|engineering|nursing) (school|college)$|^honors (college|program)\b/i;

/** Degree names compared loosely: "B.S." and "Bachelor of Science" are the same degree. */
function degreeKey(value: string | null): string {
  const text = norm(value).replace(/\s+/g, "");
  if (!text) return "";
  if (/^(bs|bsc|bachelorofscience)/.test(text)) return "bs";
  if (/^(ba|bachelorofarts)/.test(text)) return "ba";
  if (/^(bba|bachelorofbusinessadministration)/.test(text)) return "bba";
  if (/^(ms|msc|masterofscience)/.test(text)) return "ms";
  if (/^(ma|masterofarts)/.test(text)) return "ma";
  if (/^(mba|masterofbusinessadministration)/.test(text)) return "mba";
  if (/^(phd|doctorofphilosophy)/.test(text)) return "phd";
  return text;
}

const hasDegreeDetails = (entry: ParsedEducation) =>
  Boolean(entry.degree || entry.major || entry.gradDate || entry.gpa != null || entry.honors.length || entry.coursework.length);

const union = (a: string[], b: string[]) => {
  const out = [...a];
  for (const item of b) if (!out.some((x) => norm(x) === norm(item))) out.push(item);
  return out;
};

function merge(into: ParsedEducation, from: ParsedEducation, school = into.school): ParsedEducation {
  return {
    school,
    degree: into.degree ?? from.degree,
    major: into.major ?? from.major,
    minor: into.minor ?? from.minor,
    gradDate: into.gradDate ?? from.gradDate,
    gpa: into.gpa ?? from.gpa,
    honors: union(into.honors, from.honors),
    coursework: union(into.coursework, from.coursework),
    details: union(into.details ?? [], from.details ?? []),
  };
}

/** Two records of the same degree: same school, the same degree (loosely), and graduation months that don't disagree. */
export function sameSchool(a: Pick<ParsedEducation, "school" | "degree" | "gradDate">, b: Pick<ParsedEducation, "school" | "degree" | "gradDate">): boolean {
  if (norm(a.school) !== norm(b.school)) return false;
  const da = degreeKey(a.degree);
  const db = degreeKey(b.degree);
  if (da && db) return da === db && (!a.gradDate || !b.gradDate || a.gradDate === b.gradDate);
  // One side names no degree: the same school counts as a repeat only when the dates don't disagree.
  return !a.gradDate || !b.gradDate || a.gradDate === b.gradDate;
}

export function tidyEducation(entries: ParsedEducation[]): ParsedEducation[] {
  const cleaned = entries
    .map((entry) => ({ ...entry, school: entry.school.replace(/\s+/g, " ").trim(), details: entry.details ?? [] }))
    .filter((entry) => entry.school);

  // A bare university line and the school within it that holds the degree.
  const joined: ParsedEducation[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const entry = cleaned[i];
    const next = cleaned[i + 1];
    if (next && !hasDegreeDetails(entry) && SUB_UNIT.test(next.school) && !SUB_UNIT.test(entry.school)) {
      joined.push(merge(next, entry, entry.school));
      i++;
      continue;
    }
    // "University of X" after its own college's line, the other way round.
    const previous = joined.at(-1);
    if (previous && !hasDegreeDetails(entry) && SUB_UNIT.test(previous.school) && !SUB_UNIT.test(entry.school)) {
      joined[joined.length - 1] = merge(previous, entry, entry.school);
      continue;
    }
    joined.push(entry);
  }

  const result: ParsedEducation[] = [];
  for (const entry of joined) {
    const index = result.findIndex((kept) => sameSchool(kept, entry));
    if (index >= 0) result[index] = merge(result[index], entry);
    else result.push(entry);
  }
  // A school named with no degree, when the same school also has a degree, is the header of that degree.
  const out: ParsedEducation[] = [];
  for (const entry of result) {
    const owner = hasDegreeDetails(entry) ? -1 : result.findIndex((other) => other !== entry && norm(other.school) === norm(entry.school) && hasDegreeDetails(other));
    if (owner < 0) {
      out.push(entry);
      continue;
    }
    const target = result[owner];
    target.details = union(target.details, entry.details);
  }
  return out;
}
