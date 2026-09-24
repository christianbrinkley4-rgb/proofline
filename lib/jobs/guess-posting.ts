/**
 * Best guess at a pasted posting's title, company, and place, so pasting a job is
 * one step instead of a form. The student sees and can fix every guess before
 * anything is scored.
 */

const ROLE_WORD =
  /\b(intern(ship)?|co-?op|analyst|associate|assistant|coordinator|manager|engineer|developer|designer|specialist|representative|consultant|clerk|technician|officer|accountant|auditor|administrator|advisor|agent|cashier|nurse|teacher|tutor|fellow|trainee|apprentice|scientist|researcher|writer|editor|planner|recruiter|lead|director|supervisor|operator|driver|server|barista|host)\b/i;

const NOISE = /^(about (the )?(job|role|company|us)|job description|description|overview|responsibilities|qualifications|apply( now)?|save|share|easy apply|show more|see more|promoted|reposted.*|\d+ (applicants|people clicked).*)$/i;

// City names need their capitals to be told apart from prose, so only the work modes ignore case.
const PLACE = /\b([Rr]emote|[Hh]ybrid|[Oo]n-?[Ss]ite|[A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2}\b|United States)\b/;

export type PostingGuess = { title: string; company: string; location: string };

function clean(s: string) {
  return s.replace(/\s+/g, " ").replace(/^[\s\-·|•:]+|[\s\-·|•:]+$/g, "").trim();
}

/** Splits "Acme Health · Raleigh, NC (Hybrid)" into its parts. */
function segments(line: string): string[] {
  return line.split(/\s+[·|•]\s+|\s+-\s+|\s{2,}/).map(clean).filter(Boolean);
}

export function guessPosting(text: string): PostingGuess {
  const lines = text
    .split(/\r?\n/)
    .map(clean)
    .filter((l) => l && l.length <= 140 && !NOISE.test(l))
    .slice(0, 12);
  const out: PostingGuess = { title: "", company: "", location: "" };

  for (const line of lines.slice(0, 4)) {
    const at = line.match(/^(.{3,90}?)\s+(?:at|@)\s+(.{2,70})$/i);
    if (at && ROLE_WORD.test(at[1])) return withPlace({ title: clean(at[1]), company: segments(at[2])[0] ?? clean(at[2]), location: "" }, lines);
    const hiring = line.match(/^(.{2,70}?)\s+is hiring(?: an?)?\s+(.{3,90})$/i);
    if (hiring) return withPlace({ company: clean(hiring[1]), title: clean(hiring[2]).replace(/[.!]$/, ""), location: "" }, lines);
  }

  const titleIndex = lines.findIndex((l) => ROLE_WORD.test(l) && l.split(" ").length <= 12);
  if (titleIndex >= 0) {
    out.title = segments(lines[titleIndex])[0] ?? lines[titleIndex];
    // The company usually sits just above or below the title (LinkedIn puts it above, many boards below).
    const near = [lines[titleIndex + 1], lines[titleIndex - 1]].filter((l): l is string => Boolean(l) && !ROLE_WORD.test(l!));
    for (const candidate of near) {
      const first = segments(candidate)[0];
      if (first && first.length <= 60 && !PLACE.test(first)) {
        out.company = first;
        break;
      }
    }
  }
  return withPlace(out, lines);
}

function withPlace(guess: PostingGuess, lines: string[]): PostingGuess {
  if (guess.location) return guess;
  for (const line of lines.slice(0, 6)) {
    const hit = segments(line).find((s) => PLACE.test(s) && s.length <= 60 && s !== guess.title && s !== guess.company);
    if (hit) return { ...guess, location: hit };
  }
  return guess;
}

/** A single link, as opposed to pasted posting text. */
export function isLink(input: string): boolean {
  return /^https?:\/\/\S+$/i.test(input.trim());
}
