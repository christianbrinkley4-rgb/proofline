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
import { discoveredBoardsForUser } from "./discovery";
import { isRemoteText, isUSLocation, matchesPlace, resolvePlace } from "./locations";
import { boardsFor, workdayFor } from "./registry";
import { familiesFor, titleExcluded, titleWordsFor, workdayQueriesFor } from "./roles";
import { fetchBoard, fetchBoardDetail, type BoardRef } from "./sources/boards";
import { mapLimit } from "./sources/http";
import { adzunaConfigured, planMuseSearches, searchAdzuna, searchHimalayas, searchJobicy, searchMuse, searchUsaJobs, searchWorkday, usajobsConfigured, workdayDetail } from "./sources/search-apis";
import { saveMatches, upsertJobs, type JobRow } from "./store";
import { collapseLocations, isStale, SOURCE_RANK } from "./collapse";
import { dedupeKey } from "./text";
import type { JobIntent, NormalizedJob, SearchProgress, SearchStats } from "./types";

/**
 * The agent's job hunt: one plain-language query in, ranked real openings out.
 * Boards are cached briefly so repeat searches are fast;
 * everything that matches is stored and scored for this person.
 */

const BOARD_TTL_MS = 30 * 60 * 1000;
type BoardCacheEntry = { at: number; jobs: NormalizedJob[]; promise?: Promise<NormalizedJob[]> };
type BoardCache = Map<string, BoardCacheEntry>;
const globalCache = globalThis as unknown as { __prooflineBoards?: BoardCache };
const boardCache: BoardCache = (globalCache.__prooflineBoards ??= new Map());

/** Test helper: drop cached board listings (and in-flight promises). */
export function clearBoardJobsCache() {
  boardCache.clear();
}

/**
 * Fetches a company board with a short TTL. Concurrent callers share one in-flight
 * promise; a failed fetch keeps prior good data and does not refresh the TTL with [].
 */
export async function boardJobs(ref: BoardRef, signal?: AbortSignal): Promise<NormalizedJob[]> {
  assertNotAborted(signal);
  const key = `${ref.source}:${ref.slug}`;
  const hit = boardCache.get(key);
  if (hit?.promise) return hit.promise;
  if (hit && Date.now() - hit.at < BOARD_TTL_MS) return hit.jobs;

  const priorJobs = hit?.jobs;
  const priorAt = hit?.at ?? 0;
  const promise = fetchBoard(ref)
    .then((jobs) => {
      boardCache.set(key, { at: Date.now(), jobs });
      return jobs;
    })
    .catch(() => {
      if (priorJobs && priorJobs.length) {
        boardCache.set(key, { at: priorAt, jobs: priorJobs });
        return priorJobs;
      }
      boardCache.delete(key);
      return [] as NormalizedJob[];
    });

  boardCache.set(key, { at: priorAt, jobs: priorJobs ?? [], promise });
  return promise;
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

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("Search aborted");
    err.name = "AbortError";
    throw err;
  }
}

export function passesSearchFilters(job: NormalizedJob, intent: JobIntent, roleWords: string[], places: ReturnType<typeof resolvePlace>[], dealBreakers: string[] = []): boolean {
  if (dealBreakerMatches(dealBreakers, job)) return false;
  if (roleWords.length && !titleMatches(job.title, roleWords)) return false;
  if (titleExcluded(job.title, intent.roles)) return false;
  if (intent.level === "internship" && job.level !== "internship") return false;
  if (intent.level === "entry" && (job.level === "experienced" || job.level === "internship")) return false;
  if (termFits(job.title, intent.term) === "other") return false;
  const text = `${job.title} ${job.department ?? ""}`.toLowerCase();
  if (intent.exclude.some((w) => w !== "cpa" && text.includes(w.toLowerCase()))) return false;
  if (intent.payFloor && job.payMax != null && job.payPeriod === intent.payFloor.period && job.payMax < intent.payFloor.amount) return false;

  // A stated mode is a constraint when the posting identifies its mode. Unknown
  // postings remain eligible until their full description can be inspected.
  if (intent.modes.length && job.mode !== "unknown" && !intent.modes.includes(job.mode)) return false;

  const remoteOk = !intent.modes.length || intent.modes.includes("remote");
  const remoteJob = job.mode === "remote" || isRemoteText(job.location);
  const valid = places.filter((p) => p !== null);
  if (valid.length) {
    const broadlyRemote = /\b(anywhere|worldwide|global)\b/i.test(job.location ?? "") || /^remote$/i.test(job.location?.trim() ?? "");
    const remoteInUS = isUSLocation(job.location) && valid.some((place) => Boolean(place.state));
    return valid.some((p) => matchesPlace(job.location, p)) || (remoteJob && remoteOk && (broadlyRemote || remoteInUS));
  }
  if (intent.modes.length === 1 && intent.modes[0] === "remote") return remoteJob;
  return true;
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

function toResults(
  scored: Array<{ job: JobRow; fit: FitReport; termMatch: boolean }>,
  alsoIn: Map<string, string[]>,
): JobResult[] {
  return scored.map(({ job, fit, termMatch }) => ({
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
  }));
}

function scoreRows(
  final: NormalizedJob[],
  rows: Map<string, JobRow>,
  dismissed: Set<string>,
  candidate: Awaited<ReturnType<typeof loadCandidate>>,
  index: ReturnType<typeof indexCandidate>,
  intent: JobIntent,
): Array<{ job: JobRow; fit: FitReport; termMatch: boolean }> {
  const scored: Array<{ job: JobRow; fit: FitReport; termMatch: boolean }> = [];
  for (const job of final) {
    const row = rows.get(`${job.source}|${job.sourceId}`);
    if (!row || dismissed.has(row.id)) continue;
    const requirements = (row.requirements as unknown as ReturnType<typeof parseRequirements> | null) ?? parseRequirements(row.description);
    const fit = scoreFit({ title: row.title, location: row.location, mode: row.mode, level: row.level, requirements }, candidate, index);
    scored.push({ job: row, fit, termMatch: termFits(row.title, intent.term) === "match" });
  }
  scored.sort((a, b) => b.fit.score - a.fit.score || Number(b.termMatch) - Number(a.termMatch));
  return scored;
}

export async function searchJobs(
  userId: string,
  query: string,
  emit: (event: SearchProgress) => void = () => {},
  opts: { savedSearchId?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<{ intent: JobIntent; results: JobResult[]; stats: SearchStats }> {
  const started = Date.now();
  const signal = opts.signal;
  assertNotAborted(signal);

  const profile = await getProfile(userId);
  // Overlap profile-heavy candidate load with network search work.
  const candidatePromise = loadCandidate(userId);
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
  let sourcesSearched = 3;

  const keep = (jobs: NormalizedJob[]) => jobs.filter((j) => passesSearchFilters(j, intent, roleWords, places, dealBreakers));

  // Tag-filtered company boards plus any ATS boards discovered from this user's saves.
  const selected = boardsFor(intent.roles);
  const discovered = await discoveredBoardsForUser(userId);
  const seenBoard = new Set(selected.map((b) => `${b.source}:${b.slug.toLowerCase()}`));
  const boards = [
    ...selected,
    ...discovered.filter((b) => !seenBoard.has(`${b.source}:${b.slug.toLowerCase()}`)),
  ];

  const families = familiesFor(intent.roles);
  const workdayQueries = workdayQueriesFor(intent.roles, intent.level);
  const workday = workdayFor(intent.roles, intent.locations);
  const museLevels = intent.level === "internship" ? ["Internship"] : intent.level === "entry" ? ["Entry Level"] : [];
  const museCategories = [...new Set(families.map((f) => f.museCategory).filter((c): c is string => Boolean(c)))];
  const museLocations = [
    ...places.filter((p) => p !== null).map((p) => (p.state && p.cities[0] ? `${p.cities[0].replace(/\b\w/g, (c) => c.toUpperCase())}, ${p.state}` : p.label)),
    ...(intent.modes.includes("remote") || !places.length ? ["Flexible / Remote"] : []),
  ];
  const remoteKeyword = workdayQueries[0]?.trim();

  emit({ type: "status", message: `Searching ${boards.length} company job boards` });

  // Overlap Workday, Muse, and remote feeds with the company-board phase.
  const boardPhase = (async () => {
    let done = 0;
    let scanned = 0;
    const kept: NormalizedJob[] = [];
    await mapLimit(boards, 12, async (ref) => {
      assertNotAborted(signal);
      const jobs = await boardJobs(ref, signal);
      scanned += jobs.length;
      kept.push(...keep(jobs));
      done++;
      if (done % 20 === 0 || done === boards.length) emit({ type: "status", message: `Searched ${done} of ${boards.length} company boards` });
    });
    emit({ type: "source", source: "Company job boards", found: kept.length });
    return { scanned, kept };
  })();

  const workdayPhase = (async () => {
    emit({ type: "status", message: `Checking ${workday.length} large employers (banks, Big 4, NC employers)` });
    const wdFound = (
      await mapLimit(workday, 6, async (ref) => {
        assertNotAborted(signal);
        const results: NormalizedJob[] = [];
        for (const keyword of workdayQueries) {
          assertNotAborted(signal);
          results.push(...await searchWorkday(ref, keyword, workdayQueries.length > 1 ? 1 : 2).catch(() => [] as NormalizedJob[]));
        }
        return results;
      })
    ).flat();
    const kept = keep(wdFound);
    emit({ type: "source", source: "Large employers", found: kept.length });
    return { scanned: wdFound.length, kept };
  })();

  const musePhase = (async () => {
    emit({ type: "status", message: "Checking The Muse" });
    const musePlans = planMuseSearches(museLevels, museCategories, places.length ? museLocations : []);
    const muse = (await mapLimit(musePlans, 3, async (plan) => {
      assertNotAborted(signal);
      return searchMuse(plan).catch(() => [] as NormalizedJob[]);
    })).flat();
    const kept = keep(muse);
    emit({ type: "source", source: "The Muse", found: kept.length });
    return { scanned: muse.length, kept };
  })();

  const remotePhase = (async () => {
    if (!remoteKeyword) return { scanned: 0, kept: [] as NormalizedJob[], sources: 0 };
    emit({ type: "status", message: "Checking global remote job feeds" });
    assertNotAborted(signal);
    const feeds = await Promise.all([
      searchHimalayas(remoteKeyword).catch(() => [] as NormalizedJob[]),
      searchJobicy(remoteKeyword).catch(() => [] as NormalizedJob[]),
    ]);
    const kept: NormalizedJob[] = [];
    let scanned = 0;
    for (const [index, feed] of feeds.entries()) {
      scanned += feed.length;
      const matched = keep(feed);
      kept.push(...matched);
      emit({ type: "source", source: index === 0 ? "Himalayas" : "Jobicy", found: matched.length });
    }
    return { scanned, kept, sources: feeds.length };
  })();

  const [boardOut, workdayOut, museOut, remoteOut] = await Promise.all([boardPhase, workdayPhase, musePhase, remotePhase]);
  assertNotAborted(signal);

  sourcesSearched += remoteOut.sources;
  let scanned = boardOut.scanned + workdayOut.scanned + museOut.scanned + remoteOut.scanned;
  const candidates: NormalizedJob[] = [...boardOut.kept, ...workdayOut.kept, ...museOut.kept, ...remoteOut.kept];

  if (adzunaConfigured() || usajobsConfigured()) {
    const where = intent.locations[0] ?? null;
    const keyword = workdayQueries[0];
    const extra = (await Promise.all([searchAdzuna(keyword, where).catch(() => []), searchUsaJobs(keyword, where).catch(() => [])])).flat();
    sourcesSearched += Number(adzunaConfigured()) + Number(usajobsConfigured());
    scanned += extra.length;
    candidates.push(...keep(extra));
  }

  assertNotAborted(signal);

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

  const candidate = await candidatePromise;
  const index = indexCandidate(candidate);

  // Early title-level results (descriptions may still be missing) so the UI can paint sooner.
  emit({ type: "status", message: `Scoring ${top.length} early matches` });
  let rows = await upsertJobs(top);
  assertNotAborted(signal);
  const rowIds = [...rows.values()].map((r) => r.id);
  const dismissed = new Set(
    rowIds.length
      ? (await db.query.jobMatch.findMany({
          where: and(eq(schema.jobMatch.userId, userId), eq(schema.jobMatch.status, "dismissed"), inArray(schema.jobMatch.jobId, rowIds)),
          columns: { jobId: true },
        })).map((m) => m.jobId)
      : [],
  );
  const earlyScored = scoreRows(top, rows, dismissed, candidate, index, intent);
  emit({ type: "results", results: toResults(earlyScored, alsoIn), partial: true });

  const needDetail = top.filter((j) => !j.description);
  if (needDetail.length) {
    emit({ type: "status", message: `Reading ${needDetail.length} full postings` });
    await mapLimit(needDetail, 8, async (job) => {
      assertNotAborted(signal);
      const detail = await (job.source === "workday" ? workdayDetail(job.sourceId) : fetchBoardDetail(job.source, job.sourceId)).catch(() => null);
      if (detail) Object.assign(job, detail);
    });
  }

  assertNotAborted(signal);

  // Exclusions that live in the description ("don't require the CPA", deal-breakers like "Unpaid")
  const final = top.filter((job) => {
    if (!passesSearchFilters(job, intent, roleWords, places, dealBreakers)) return false;
    if (!intent.exclude.includes("cpa") || !job.description) return true;
    return !parseRequirements(job.description).licensesRequired.includes("CPA");
  });

  emit({ type: "status", message: `Scoring ${final.length} matches against your profile` });
  rows = await upsertJobs(final);
  assertNotAborted(signal);
  const scored = scoreRows(final, rows, dismissed, candidate, index, intent);
  await saveMatches(userId, scored, opts.savedSearchId);

  const stats: SearchStats = {
    boardsSearched: boards.length + workday.length,
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
    results: toResults(scored, alsoIn),
  };
}
