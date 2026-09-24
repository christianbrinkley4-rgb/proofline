import type { NormalizedJob } from "./types";

/** Direct employer sources beat aggregators when the same role shows up twice. */
export const SOURCE_RANK: Record<NormalizedJob["source"], number> = {
  greenhouse: 5, lever: 5, ashby: 5, workday: 5, smartrecruiters: 4, link: 4, themuse: 2, usajobs: 3, adzuna: 1,
};

export const AGGREGATORS = new Set<NormalizedJob["source"]>(["themuse", "adzuna", "usajobs"]);

/** Aggregator postings older than this are usually closed or from a past hiring cycle. */
export const STALE_DAYS = 120;

export function isStale(job: Pick<NormalizedJob, "source" | "postedAt">, now = Date.now()): boolean {
  return AGGREGATORS.has(job.source) && job.postedAt != null && now - job.postedAt.getTime() > STALE_DAYS * 864e5;
}

/**
 * Collapses one company's same-titled posting across cities into a single result.
 * The kept posting is the one that best fits the search (`fit`), then the most direct
 * source, then the newest; the others are listed by location.
 */
export function collapseLocations(
  jobs: NormalizedJob[],
  fit: (job: NormalizedJob) => number,
): { kept: NormalizedJob[]; alsoIn: Map<string, string[]> } {
  const groups = new Map<string, NormalizedJob[]>();
  for (const job of jobs) {
    const key = `${job.company.toLowerCase().replace(/[^a-z0-9]/g, "")}|${job.title.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  const kept: NormalizedJob[] = [];
  const alsoIn = new Map<string, string[]>();
  for (const group of groups.values()) {
    const [best, ...rest] = [...group].sort(
      (a, b) => fit(b) - fit(a) || SOURCE_RANK[b.source] - SOURCE_RANK[a.source] || (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0),
    );
    kept.push(best);
    const others = [...new Set(rest.map((j) => j.location).filter((l): l is string => Boolean(l) && l !== best.location))];
    if (others.length) alsoIn.set(`${best.source}|${best.sourceId}`, others);
  }
  return { kept, alsoIn };
}
