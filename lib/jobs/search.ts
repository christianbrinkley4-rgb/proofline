import { and, eq, inArray } from "drizzle-orm";
import { logEvent } from "@/lib/agent/events";
import { dealBreakerMatches } from "@/lib/agent/learn";
import { db, schema } from "@/lib/db";
import { loadCandidate } from "@/lib/fit/candidate";
import { indexCandidate, scoreFit, titleMatches, type FitReport } from "@/lib/fit/engine";
import { parseRequirements } from "@/lib/fit/requirements";
import { fitBand } from "@/lib/fit/rubric";
import { getProfile } from "@/lib/kb/profile";
import { parseIntent } from "./intent";
import { isRemoteText, isUSLocation, matchesPlace, resolvePlace } from "./locations";
import { BOARDS, workdayFor } from "./registry";
import { familiesFor, titleExcluded, titleWordsFor } from "./roles";
import { fetchBoard, fetchBoardDetail, type BoardRef } from "./sources/boards";
import { mapLimit } from "./sources/http";
import { adzunaConfigured, searchAdzuna, searchMuse, searchUsaJobs, searchWorkday, usajobsConfigured, workdayDetail } from "./sources/search-apis";
import { saveMatches, upsertJobs, type JobRow } from "./store";
import { collapseLocations, isStale, SOURCE_RANK } from "./collapse";
import { dedupeKey } from "./text";
import type { JobIntent, NormalizedJob, SearchProgress, SearchStats } from "./types";

/**
 * The agent's job hunt: one plain-language query in, ranked real openings out.
 * Boards are cached in memory for a few hours so repeat searches are instant;
 * everything that matches is stored and scored for this student.
 */

const BOARD_TTL_MS = 6 * 60 * 60 * 1000;
type BoardCache = Map<string, { at: number; jobs: NormalizedJob[] }>;
const globalCache = globalThis as unknown as { __prooflineBoards?: BoardCache };
const boardCache: BoardCache = (globalCache.__prooflineBoards ??= new Map());

async function boardJobs(ref: BoardRef): Promise<NormalizedJob[]> {
  const key = `${ref.source}:${ref.slug}`;
  const hit = boardCache.get(key);
  if (hit && Date.now() - hit.at < BOARD_TTL_MS) return hit.jobs;
  const jobs = await fetchBoard(ref).catch(() => hit?.jobs ?? []);
  boardCache.set(key, { at: Date.now(), jobs });
  return jobs;
}

const SEASONS = /\b(summer|fall|spring|winter)\s*'?(20\d{2}|\d{2})\b/i;

function termFits(title: string, term: string | null): "match" | "other" | "none" {
  if (!term) return "none";
  const m = title.match(SEASONS);
  if (!m) {
    const year = title.match(/\b20\d{2}\b/)?.[0];
    return year && !term.includes(year) ? "other" : "none";
  }
  const year = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${year}` === term ? "match" : "other";
}

function passes(job: NormalizedJob, intent: JobIntent, roleWords: string[], places: ReturnType<typeof resolvePlace>[], dealBreakers: string[] = []): boolean {
  if (dealBreakerMatches(dealBreakers, job)) return false;
  if (roleWords.length && !titleMatches(job.title, roleWords)) return false;
  if (titleExcluded(job.title, intent.roles)) return false;
  if (intent.level === "internship" && job.level !== "internship") return false;
  if (intent.level === "entry" && (job.level === "experienced" || job.level === "internship")) return false;
  if (termFits(job.title, intent.term) === "other") return false;
  const text = `${job.title} ${job.department ?? ""}`.toLowerCase();
  if (intent.exclude.some((w) => w !== "cpa" && text.includes(w.toLowerCase()))) return false;
  if (intent.payFloor && job.payMax != null && job.payPeriod === intent.payFloor.period && job.payMax < intent.payFloor.amount) return false;

  const remoteOk = !intent.modes.length || intent.modes.includes("remote");
  const remoteJob = job.mode === "remote" || isRemoteText(job.location);
  const valid = places.filter((p) => p !== null);
  if (valid.length) {
    return valid.some((p) => matchesPlace(job.location, p)) || (remoteJob && remoteOk && isUSLocation(job.location ?? "US"));
  }
  if (intent.modes.length === 1 && intent.modes[0] === "remote") return remoteJob;
  return isUSLocation(job.location) || (remoteJob && !/\b(uk|europe|emea|apac|india|canada|germany|london)\b/i.test(job.location ?? ""));
}

export type JobResult = {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  mode: string;
  level: string;
  pay: string | null;
  postedAt: string | null;
  source: string;
  url: string;
  score: number;
  band: string;
  cappedBy: string | null;
  status: string;
  termMatch: boolean;
  /** Other cities where the same role is posted. */
  alsoIn: string[];
};

export function formatPay(job: Pick<JobRow, "payMin" | "payMax" | "payPeriod">): string | null {
  if (job.payMin == null && job.payMax == null) return null;
  const fmt = (n: number) => (job.payPeriod === "hour" ? `$${Math.round(n)}` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  const range = job.payMin != null && job.payMax != null && job.payMin !== job.payMax ? `${fmt(job.payMin)}–${fmt(job.payMax)}` : fmt((job.payMax ?? job.payMin)!);
  return `${range}${job.payPeriod === "hour" ? "/hr" : job.payPeriod === "year" ? "/yr" : ""}`;
}

export async function searchJobs(
  userId: string,
  query: string,
  emit: (event: SearchProgress) => void = () => {},
  opts: { savedSearchId?: string; limit?: number } = {},
): Promise<{ intent: JobIntent; results: JobResult[]; stats: SearchStats }> {
  const started = Date.now();
  const profile = await getProfile(userId);
  const dealBreakers = profile?.dealBreakers ?? [];
  const intent = parseIntent(query, {
    targetRoles: profile?.targetRoles,
    targetLocations: profile?.targetLocations,
    workModes: profile?.workModes,
    targetTerm: profile?.targetTerm,
    payFloor: profile?.payFloor,
  });
  emit({ type: "intent", intent });

  const roleWords = titleWordsFor(intent.roles);
  const places = intent.locations.map(resolvePlace);
  const candidates: NormalizedJob[] = [];
  let scanned = 0;

  // Company boards
  emit({ type: "status", message: `Searching ${BOARDS.length} company job boards` });
  let done = 0;
  await mapLimit(BOARDS, 12, async (ref) => {
    const jobs = await boardJobs(ref);
    scanned += jobs.length;
    candidates.push(...jobs.filter((j) => passes(j, intent, roleWords, places, dealBreakers)));
    done++;
    if (done % 20 === 0 || done === BOARDS.length) emit({ type: "status", message: `Searched ${done} of ${BOARDS.length} company boards` });
  });
  emit({ type: "source", source: "Company job boards", found: candidates.length });

  // Big employers on Workday, searched by keyword
  const families = familiesFor(intent.roles);
  const keyword = [families[0]?.label ?? intent.roles[0] ?? "", intent.level === "internship" ? "intern" : intent.level === "entry" ? "analyst" : ""]
    .join(" ")
    .trim()
    .replace(/ and .*/, "");
  const workday = workdayFor(intent.roles, intent.locations);
  emit({ type: "status", message: `Checking ${workday.length} large employers (banks, Big 4, NC employers)` });
  const wdFound = (
    await mapLimit(workday, 6, (ref) => searchWorkday(ref, keyword || "intern").catch(() => [] as NormalizedJob[]))
  ).flat();
  scanned += wdFound.length;
  const wdKept = wdFound.filter((j) => passes(j, intent, roleWords, places, dealBreakers));
  candidates.push(...wdKept);
  emit({ type: "source", source: "Large employers", found: wdKept.length });

  // Aggregators
  let sourcesSearched = 2;
  const museLevels = intent.level === "internship" ? ["Internship"] : intent.level === "entry" ? ["Entry Level"] : ["Internship", "Entry Level"];
  const museCategories = [...new Set(families.map((f) => f.museCategory).filter((c): c is string => Boolean(c)))];
  const museLocations = [
    ...places.filter((p) => p !== null).map((p) => (p.state && p.cities[0] ? `${p.cities[0].replace(/\b\w/g, (c) => c.toUpperCase())}, ${p.state}` : p.label)),
    ...(intent.modes.includes("remote") || !places.length ? ["Flexible / Remote"] : []),
  ];
  emit({ type: "status", message: "Checking The Muse" });
  const muse = await searchMuse({ levels: museLevels, categories: museCategories, locations: places.length ? museLocations : [], pages: 3 }).catch(() => []);
  scanned += muse.length;
  const museKept = muse.filter((j) => passes(j, intent, roleWords, places, dealBreakers));
  candidates.push(...museKept);
  emit({ type: "source", source: "The Muse", found: museKept.length });

  if (adzunaConfigured() || usajobsConfigured()) {
    const where = intent.locations[0] ?? null;
    const extra = (await Promise.all([searchAdzuna(`${keyword}`, where).catch(() => []), searchUsaJobs(keyword, where).catch(() => [])])).flat();
    sourcesSearched += 1;
    scanned += extra.length;
    candidates.push(...extra.filter((j) => passes(j, intent, roleWords, places, dealBreakers)));
  }

  // Merge duplicates: same company, title, and city from several boards
  const byKey = new Map<string, NormalizedJob>();
  for (const job of candidates) {
    const key = dedupeKey(job.company, job.title, job.location);
    const current = byKey.get(key);
    if (!current || SOURCE_RANK[job.source] > SOURCE_RANK[current.source] || (!current.description && job.description && SOURCE_RANK[job.source] === SOURCE_RANK[current.source])) {
      byKey.set(key, job);
    }
  }
  const deduped = [...byKey.values()];

  // Aggregator listings linger after a role closes; employer boards only list open roles, so age isn't a signal there.
  const now = Date.now();
  const current = deduped.filter((j) => !isStale(j, now));
  const staleDropped = deduped.length - current.length;

  // One role posted in several cities becomes one result, shown where it best fits the search.
  const { kept: unique, alsoIn } = collapseLocations(current, (job) => {
    const valid = places.filter((p) => p !== null);
    return valid.some((p) => matchesPlace(job.location, p)) ? 2 : job.mode === "remote" ? 1 : 0;
  });
  const duplicatesMerged = candidates.length - deduped.length + (current.length - unique.length);

  // Most promising first, then fetch full descriptions so they can be scored properly
  unique.sort((a, b) => {
    const t = Number(termFits(b.title, intent.term) === "match") - Number(termFits(a.title, intent.term) === "match");
    return t || (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0);
  });
  const top = unique.slice(0, opts.limit ?? 60);
  const needDetail = top.filter((j) => !j.description);
  if (needDetail.length) emit({ type: "status", message: `Reading ${needDetail.length} full postings` });
  await mapLimit(needDetail, 8, async (job) => {
    const detail = await (job.source === "workday" ? workdayDetail(job.sourceId) : fetchBoardDetail(job.source, job.sourceId)).catch(() => null);
    if (detail) Object.assign(job, detail);
  });

  // Exclusions that live in the description ("don't require the CPA", deal-breakers like "Unpaid")
  const final = top.filter((job) => {
    if (dealBreakerMatches(dealBreakers, job)) return false;
    if (!intent.exclude.includes("cpa") || !job.description) return true;
    return !parseRequirements(job.description).licensesRequired.includes("CPA");
  });

  emit({ type: "status", message: `Scoring ${final.length} matches against your profile` });
  const rows = await upsertJobs(final);
  const candidate = await loadCandidate(userId);
  const index = indexCandidate(candidate);
  // A job the student already turned down stays gone.
  const rowIds = [...rows.values()].map((r) => r.id);
  const dismissed = new Set(
    rowIds.length
      ? (await db.query.jobMatch.findMany({
          where: and(eq(schema.jobMatch.userId, userId), eq(schema.jobMatch.status, "dismissed"), inArray(schema.jobMatch.jobId, rowIds)),
          columns: { jobId: true },
        })).map((m) => m.jobId)
      : [],
  );
  const scored: Array<{ job: JobRow; fit: FitReport; termMatch: boolean }> = [];
  for (const job of final) {
    const row = rows.get(`${job.source}|${job.sourceId}`);
    if (!row || dismissed.has(row.id)) continue;
    const requirements = (row.requirements as unknown as ReturnType<typeof parseRequirements> | null) ?? parseRequirements(row.description);
    const fit = scoreFit({ title: row.title, location: row.location, mode: row.mode, level: row.level, requirements }, candidate, index);
    scored.push({ job: row, fit, termMatch: termFits(row.title, intent.term) === "match" });
  }
  scored.sort((a, b) => b.fit.score - a.fit.score || Number(b.termMatch) - Number(a.termMatch));
  await saveMatches(userId, scored, opts.savedSearchId);

  const stats: SearchStats = {
    boardsSearched: BOARDS.length + workday.length,
    sourcesSearched,
    scanned,
    matched: scored.length,
    duplicatesMerged,
    staleDropped,
    ms: Date.now() - started,
  };
  emit({ type: "done", stats });
  await logEvent(userId, "search_run", { query, matched: scored.length, scanned, roles: intent.roles, locations: intent.locations, savedSearchId: opts.savedSearchId ?? null });

  return {
    intent,
    stats,
    results: scored.map(({ job, fit, termMatch }) => ({
      jobId: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      mode: job.mode,
      level: job.level,
      pay: formatPay(job),
      postedAt: job.postedAt?.toISOString() ?? null,
      source: job.source,
      url: job.url,
      score: fit.score,
      band: fitBand(fit.score),
      cappedBy: fit.cappedBy?.reason ?? null,
      status: "new",
      termMatch,
      alsoIn: alsoIn.get(`${job.source}|${job.sourceId}`) ?? [],
    })),
  };
}
