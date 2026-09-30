import { isRemoteText, matchesPlace, resolvePlace } from "@/lib/jobs/locations";
import type { JobMode } from "@/lib/jobs/types";
import { formatMonth, normalizeDate } from "@/lib/resume/parse/dates";
import type { Requirements } from "./requirements";

/**
 * Hard knockouts, checked before any score and never blended into it. A
 * knockout means "don't tailor for this job", and says why in plain words.
 * "unknown" means we couldn't check (the person hasn't told us yet); it never blocks.
 */

export type KnockoutKey = "graduation" | "work_authorization" | "location" | "start_date";
export type KnockoutStatus = "ok" | "knockout" | "unknown";
export type Knockout = { key: KnockoutKey; label: string; status: KnockoutStatus; reason: string; fix?: string };

export const KNOCKOUT_LABEL: Record<KnockoutKey, string> = {
  graduation: "Graduation date",
  work_authorization: "Work authorization",
  location: "Location and work mode",
  start_date: "Start date",
};

/**
 * What the knockout checks need from a description, read once when the posting is stored.
 * A start `month` of null means the posting says to start immediately (resolved against today).
 */
export type PostingScreens = { citizenship: boolean; start: { month: string | null; text: string } | null };

export type KnockoutJob = {
  title: string;
  location: string | null;
  mode: JobMode;
  description: string | null;
  requirements: Requirements;
  /** When present, used instead of reading `description`, so a caller can leave the description unloaded. */
  screens?: PostingScreens | null;
};
export type KnockoutCandidate = {
  /** YYYY-MM */
  gradDate: string | null;
  /** us_citizen, permanent_resident, authorized, needs_sponsorship, or null if not asked. */
  workAuthorization: string | null;
  targetLocations: string[];
  workModes: Array<"remote" | "hybrid" | "onsite">;
  openToRelocate: boolean | null;
  /** YYYY-MM */
  availableFrom: string | null;
};

function months(a: string, b: string): number {
  const [ay, am = 6] = a.split("-").map(Number);
  const [by, bm = 6] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

const monthLabel = (value: string) => formatMonth(value) || value;

function graduation(job: KnockoutJob, c: KnockoutCandidate): Knockout {
  const base = { key: "graduation" as const, label: KNOCKOUT_LABEL.graduation };
  const window = job.requirements.gradWindow;
  if (!window) return { ...base, status: "ok", reason: "The posting doesn't limit graduation dates." };
  if (!c.gradDate) return { ...base, status: "unknown", reason: `The posting wants students graduating ${describeWindow(window)}. Add your graduation date to check.`, fix: "education" };
  const early = window.from && months(c.gradDate, window.from) > 1;
  const late = window.to && months(window.to, c.gradDate) > 1;
  if (early || late) {
    return { ...base, status: "knockout", reason: `This role is for students graduating ${describeWindow(window)}. You graduate ${monthLabel(c.gradDate)}.` };
  }
  return { ...base, status: "ok", reason: `Your ${monthLabel(c.gradDate)} graduation fits. They want students graduating ${describeWindow(window)}.` };
}

function describeWindow(window: NonNullable<Requirements["gradWindow"]>): string {
  const { from, to } = window;
  if (from && to && from.slice(0, 4) === to.slice(0, 4) && from.endsWith("-01") && to.endsWith("-12")) return `in ${from.slice(0, 4)}`;
  if (from && to && from !== to) return `between ${monthLabel(from)} and ${monthLabel(to)}`;
  if (from && to) return `in ${monthLabel(from)}`;
  if (to) return `by ${monthLabel(to)}`;
  if (from) return `in ${monthLabel(from)} or later`;
  return window.text;
}

const CITIZENSHIP = /(u\.?s\.?|united states) citizen(ship)?\s+(is\s+)?(required|only)|must be (a )?(u\.?s\.?|united states) citizen|(requires?|require) (u\.?s\.?|united states) citizenship|security clearance (is )?required|must (be able to )?(obtain|hold) a (secret|top secret|security) clearance/i;

function authorization(job: KnockoutJob, c: KnockoutCandidate): Knockout {
  const base = { key: "work_authorization" as const, label: KNOCKOUT_LABEL.work_authorization };
  const citizenship = job.screens ? job.screens.citizenship : CITIZENSHIP.test(job.description ?? "");
  const noSponsor = job.requirements.noSponsorship;
  if (!citizenship && !noSponsor) return { ...base, status: "ok", reason: "The posting doesn't limit work authorization." };
  const rule = citizenship ? "requires U.S. citizenship or a security clearance" : "won't sponsor a work visa";
  if (!c.workAuthorization) return { ...base, status: "unknown", reason: `The posting ${rule}. Add your work authorization to check.`, fix: "logistics" };
  if (citizenship && c.workAuthorization !== "us_citizen") return { ...base, status: "knockout", reason: `The posting ${rule}, and you said you're not a U.S. citizen.` };
  if (noSponsor && c.workAuthorization === "needs_sponsorship") return { ...base, status: "knockout", reason: "The posting won't sponsor a work visa, and you said you'll need sponsorship." };
  return { ...base, status: "ok", reason: `The posting ${rule}; your work authorization meets it.` };
}

function location(job: KnockoutJob, c: KnockoutCandidate): Knockout {
  const base = { key: "location" as const, label: KNOCKOUT_LABEL.location };
  const remote = job.mode === "remote" || isRemoteText(job.location);
  const where = job.location?.trim() || null;
  const modeWord = job.mode === "onsite" ? "on-site" : job.mode;
  if (remote) return { ...base, status: "ok", reason: "It's remote." };
  if (c.workModes.length && job.mode !== "unknown" && !c.workModes.includes(job.mode as "hybrid" | "onsite")) {
    return { ...base, status: "knockout", reason: `This role is ${modeWord}${where ? ` in ${where}` : ""}, and you said you can only work ${c.workModes.join(" or ").replace("onsite", "on-site")}.` };
  }
  if (!where) return { ...base, status: "ok", reason: "The posting doesn't name a location." };
  const places = c.targetLocations.filter((l) => !/^remote$/i.test(l)).map(resolvePlace).filter((p) => p !== null);
  if (!places.length) {
    if (c.openToRelocate) return { ...base, status: "ok", reason: `It's in ${where}, and you said you'd move.` };
    return { ...base, status: "unknown", reason: `It's in ${where}. Add where you can work to check.`, fix: "logistics" };
  }
  const hit = places.find((p) => matchesPlace(where, p));
  if (hit) return { ...base, status: "ok", reason: `It's in ${where}, inside ${hit.label}.` };
  if (c.openToRelocate === true) return { ...base, status: "ok", reason: `It's in ${where}, outside the places you listed, but you said you'd move.` };
  if (c.openToRelocate === false) return { ...base, status: "knockout", reason: `It's ${job.mode === "unknown" ? "" : `${modeWord} `}in ${where}, outside where you said you can work, and you're not planning to move.` };
  return { ...base, status: "unknown", reason: `It's in ${where}, outside the places you listed. Tell us whether you'd move.`, fix: "logistics" };
}

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const SEASON_START: Record<string, string> = { spring: "01", summer: "06", fall: "09", autumn: "09", winter: "01" };

/** The month a posting says work starts, if it says. */
export function parseStartDate(text: string | null | undefined, now = new Date()): { month: string; text: string } | null {
  return resolveStart(readStart(text), now);
}

/** The stated start, with a null month for "start immediately". */
function readStart(text: string | null | undefined): PostingScreens["start"] {
  const body = text ?? "";
  const immediate = body.match(/\b(start(?:ing)? immediately|immediate start|asap start|start asap)\b/i);
  if (immediate) return { month: null, text: immediate[0] };
  const dated = body.match(new RegExp(`\\b(?:start(?:ing|s)?(?: date)?|begin(?:s|ning)?|commenc\\w*|available to start)\\b[^.\\n]{0,24}?\\b(${MONTH})\\.?\\s+(?:\\d{1,2}(?:st|nd|rd|th)?,?\\s+)?(20\\d{2})`, "i"));
  if (dated) {
    const month = normalizeDate(`${dated[1].slice(0, 3)} ${dated[2]}`);
    if (month) return { month, text: dated[0] };
  }
  const season =
    body.match(/\b(spring|summer|fall|autumn|winter)\s+(20\d{2})\b(?=[^.\n]{0,40}\b(intern(ship)?s?|co-?op|program|cohort|start|analyst class|class)\b)/i) ??
    // "Audit Intern, Summer 2027"
    body.match(/\b(?:intern(?:ship)?|co-?op|program)\b[^.\n]{0,20}?\b(spring|summer|fall|autumn|winter)\s+(20\d{2})\b/i);
  if (season) return { month: `${season[2]}-${SEASON_START[season[1].toLowerCase()]}`, text: season[0] };
  return null;
}

function startDate(job: KnockoutJob, c: KnockoutCandidate, now: Date): Knockout {
  const base = { key: "start_date" as const, label: KNOCKOUT_LABEL.start_date };
  const start = job.screens ? resolveStart(job.screens.start, now) : parseStartDate(`${job.title}\n${job.description ?? ""}`, now);
  if (!start) return { ...base, status: "ok", reason: "The posting doesn't give a start date." };
  if (!c.availableFrom) return { ...base, status: "unknown", reason: `It starts around ${monthLabel(start.month)}. Add when you can start to check.`, fix: "logistics" };
  if (months(start.month, c.availableFrom) > 1) {
    return { ...base, status: "knockout", reason: `It starts around ${monthLabel(start.month)}, and you said you can't start until ${monthLabel(c.availableFrom)}.` };
  }
  return { ...base, status: "ok", reason: `It starts around ${monthLabel(start.month)}, after you're available.` };
}

const currentMonth = (now: Date) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

function resolveStart(start: PostingScreens["start"], now: Date): { month: string; text: string } | null {
  return start ? { month: start.month ?? currentMonth(now), text: start.text } : null;
}

/** Reads the description once for the knockout checks. `checkKnockouts` gives the same result with these or the description. */
export function readScreens(title: string, description: string | null | undefined): PostingScreens {
  return { citizenship: CITIZENSHIP.test(description ?? ""), start: readStart(`${title}\n${description ?? ""}`) };
}

export function knockoutCandidate(profile: {
  gradDate: string | null;
  workAuthorization: string | null;
  targetLocations: string[];
  workModes: Array<"remote" | "hybrid" | "onsite">;
  openToRelocate: boolean | null;
  availableFrom: string | null;
} | null | undefined): KnockoutCandidate {
  return {
    gradDate: profile?.gradDate ?? null,
    workAuthorization: profile?.workAuthorization ?? null,
    targetLocations: profile?.targetLocations ?? [],
    workModes: profile?.workModes ?? [],
    openToRelocate: profile?.openToRelocate ?? null,
    availableFrom: profile?.availableFrom ?? null,
  };
}

export function checkKnockouts(job: KnockoutJob, candidate: KnockoutCandidate, now = new Date()): Knockout[] {
  return [graduation(job, candidate), authorization(job, candidate), location(job, candidate), startDate(job, candidate, now)];
}

export function firstKnockout(knockouts: Knockout[]): Knockout | null {
  return knockouts.find((k) => k.status === "knockout") ?? null;
}
