/**
 * Best guess at a pasted posting's title, company, and place, so pasting a job is
 * one step instead of a form. The student sees and can fix every guess before
 * anything is scored.
 */

const ROLE_WORD =
  /\b(intern(ship)?|co-?op|analyst|associate|assistant|coordinator|manager|engineer|developer|designer|specialist|representative|consultant|clerk|technician|officer|accountant|bookkeeper|auditor|administrator|advisor|agent|cashier|nurse|teacher|tutor|fellow|trainee|apprentice|scientist|researcher|writer|editor|planner|recruiter|lead|director|supervisor|operator|driver|mechanic|electrician|plumber|welder|carpenter|cook|chef|caregiver|aide|therapist|paralegal|librarian|server|barista|host)\b/i;

const NOISE = /^(about (the )?(job|role|company|us)|job description|description|overview|responsibilities|qualifications|apply( now)?|save|share|easy apply|show more|see more|promoted|reposted.*|\d+ (applicants|people clicked).*)$/i;

const CITY = /([A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2})\b/;

export type PostingGuess = { title: string; company: string; location: string };

function clean(s: string) {
  return s.replace(/\s+/g, " ").replace(/^[\s\-·•∙⋅‧|:,]+|[\s\-·•∙⋅‧|:,]+$/g, "").trim();
}

/** Splits "Acme Health · Raleigh, NC (Hybrid)" and Handshake's "Posted … ago∙Apply by …" lines. */
function segments(line: string): string[] {
  return line.split(/\s*[·•∙⋅‧|]\s*|\s+-\s+|\s{2,}/).map(clean).filter(Boolean);
}

/** "Posted 3 weeks ago", "Apply by October 2", applicant counts, and the same lines glued together. */
function isChrome(s: string): boolean {
  const t = clean(s);
  if (!t || NOISE.test(t)) return true;
  if (/^(posted|reposted)\b/i.test(t)) return true;
  if (/^apply by\b/i.test(t)) return true;
  if (t.length <= 48 && /\bago\b/i.test(t) && /\b(week|day|hour|month|minute)s?\b/i.test(t)) return true;
  if (/^(over )?\d+\+?\s+(applicants?|people)\b/i.test(t)) return true;
  if (/^(promoted|easy apply|actively recruiting|be an early applicant)\b/i.test(t)) return true;
  return false;
}

function extractCity(s: string): string | null {
  const based = s.match(/\b(?:based|located) in\s+([A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2})\b/);
  if (based) return based[1];
  return s.match(CITY)?.[1] ?? null;
}

/** A work mode or country with no city, kept only when nothing more specific is present. */
function barePlace(s: string): string | null {
  const t = clean(s);
  if (/^remote$/i.test(t)) return "Remote";
  if (/^hybrid$/i.test(t)) return "Hybrid";
  if (/^on-?site$/i.test(t)) return "Onsite";
  if (/^united states$/i.test(t)) return "United States";
  return null;
}

function placeOnly(s: string): boolean {
  if (barePlace(s)) return true;
  const city = extractCity(s);
  if (!city) return false;
  const rest = s
    .replace(city, "")
    .replace(/\b(remote|hybrid|on-?site|based in|located in|united states)\b/gi, "")
    .replace(/[^A-Za-z]/g, "");
  return rest.length < 3;
}

/** Logo alt text ("Pw") and board chrome are not company names. Real short names can be typed in. */
function acceptableCompany(name: string): boolean {
  const t = clean(name);
  if (!t || t.length > 60) return false;
  if (t.replace(/[^A-Za-z0-9]/g, "").length <= 2) return false;
  if (isChrome(t) || placeOnly(t)) return false;
  return true;
}

function companyFromLine(line: string): string | null {
  for (const part of segments(line)) {
    if (acceptableCompany(part)) return part;
  }
  return null;
}

function lineKept(line: string): boolean {
  if (!line || line.length > 140 || NOISE.test(line)) return false;
  if (extractCity(line) || barePlace(line)) return true;
  const parts = segments(line);
  if (parts.length > 0 && parts.every((p) => isChrome(p))) return false;
  return true;
}

export function guessPosting(text: string): PostingGuess {
  const lines = text.split(/\r?\n/).map(clean).filter(lineKept).slice(0, 12);
  const out: PostingGuess = { title: "", company: "", location: "" };
  // A short title followed by a company is stronger evidence than a later
  // sentence saying the company "is hiring" for that role.
  if (lines.length >= 2 && ROLE_WORD.test(lines[0]) && lines[0].split(/\s+/).length <= 8 &&
      !/[.!?]$/.test(lines[0]) && !/\s+(?:at|@)\s+/i.test(lines[0]) && !ROLE_WORD.test(lines[1])) {
    const company = companyFromLine(lines[1]);
    if (company) return withPlace({ title: segments(lines[0])[0] ?? lines[0], company, location: "" }, lines);
  }

  for (const line of lines.slice(0, 4)) {
    const at = line.match(/^(.{3,90}?)\s+(?:at|@)\s+(.{2,70})$/i);
    const atCompany = at ? companyFromLine(at[2]) : null;
    if (at && atCompany && ROLE_WORD.test(at[1])) return withPlace({ title: clean(at[1]), company: atCompany, location: "" }, lines);
    const hiring = line.match(/^(.{2,70}?)\s+is hiring(?: an?)?\s+(.{3,90})$/i);
    if (hiring && acceptableCompany(clean(hiring[1]))) return withPlace({ company: clean(hiring[1]), title: clean(hiring[2]).replace(/[.!]$/, ""), location: "" }, lines);
  }

  const titleIndex = lines.findIndex((l) => ROLE_WORD.test(l) && l.split(" ").length <= 12);
  if (titleIndex >= 0) {
    out.title = segments(lines[titleIndex])[0] ?? lines[titleIndex];
    // The company usually sits just above or below the title (LinkedIn puts it above, many boards below).
    const near = [lines[titleIndex + 1], lines[titleIndex - 1]].filter((l): l is string => Boolean(l) && !ROLE_WORD.test(l));
    for (const candidate of near) {
      const company = companyFromLine(candidate);
      if (company) {
        out.company = company;
        break;
      }
    }
  }
  return withPlace(out, lines);
}

function withPlace(guess: PostingGuess, lines: string[]): PostingGuess {
  if (guess.location) return guess;
  let bare: string | null = null;
  for (const line of lines.slice(0, 8)) {
    for (const part of segments(line)) {
      if (part === guess.title || part === guess.company) continue;
      const city = extractCity(part);
      if (city && city !== guess.title && city !== guess.company) return { ...guess, location: city };
      bare ??= barePlace(part);
    }
  }
  return bare ? { ...guess, location: bare } : guess;
}

/** A single link, as opposed to pasted posting text. */
export function isLink(input: string): boolean {
  return /^https?:\/\/\S+$/i.test(input.trim());
}
