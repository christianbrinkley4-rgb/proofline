import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { FitReport } from "@/lib/fit/engine";
import { parseRequirements, type Requirements } from "@/lib/fit/requirements";
import { extractKeywords } from "./keywords";
import { dedupeKey, slugify } from "./text";
import type { NormalizedJob } from "./types";

export type JobRow = typeof schema.job.$inferSelect;
export type MatchRow = typeof schema.jobMatch.$inferSelect;

const UPSERT_CHUNK = 40;
const MATCH_CHUNK = 40;

function jobValues(j: NormalizedJob) {
  const requirements = j.description ? parseRequirements(j.description) : null;
  return {
    source: j.source,
    sourceId: j.sourceId,
    company: j.company,
    companySlug: slugify(j.company),
    title: j.title,
    location: j.location,
    mode: j.mode,
    level: j.level,
    url: j.url,
    description: j.description,
    department: j.department,
    employmentType: j.employmentType,
    payMin: j.payMin,
    payMax: j.payMax,
    payPeriod: j.payPeriod,
    postedAt: j.postedAt && !Number.isNaN(j.postedAt.getTime()) ? j.postedAt : null,
    dedupeKey: dedupeKey(j.company, j.title, j.location),
    requirements: requirements as unknown as Record<string, unknown> | null,
    keywords: j.description ? extractKeywords(j.description) : null,
    fetchedAt: new Date(),
  };
}

/** Inserts or refreshes postings in chunks. Returns rows keyed by `${source}|${sourceId}`. */
export async function upsertJobs(jobs: NormalizedJob[]): Promise<Map<string, JobRow>> {
  const out = new Map<string, JobRow>();
  if (!jobs.length) return out;

  for (let i = 0; i < jobs.length; i += UPSERT_CHUNK) {
    const chunk = jobs.slice(i, i + UPSERT_CHUNK).map(jobValues);
    const rows = await db
      .insert(schema.job)
      .values(chunk)
      .onConflictDoUpdate({
        target: [schema.job.source, schema.job.sourceId],
        set: {
          company: sql`excluded.company`,
          companySlug: sql`excluded.company_slug`,
          title: sql`excluded.title`,
          location: sql`excluded.location`,
          mode: sql`excluded.mode`,
          level: sql`excluded.level`,
          url: sql`excluded.url`,
          department: sql`excluded.department`,
          employmentType: sql`excluded.employment_type`,
          payMin: sql`excluded.pay_min`,
          payMax: sql`excluded.pay_max`,
          payPeriod: sql`excluded.pay_period`,
          postedAt: sql`excluded.posted_at`,
          dedupeKey: sql`excluded.dedupe_key`,
          fetchedAt: sql`excluded.fetched_at`,
          // Keep a description we already fetched if this listing came without one.
          description: sql`coalesce(excluded.description, ${schema.job.description})`,
          requirements: sql`coalesce(excluded.requirements, ${schema.job.requirements})`,
          keywords: sql`coalesce(excluded.keywords, ${schema.job.keywords})`,
        },
      })
      .returning();
    for (const row of rows) out.set(`${row.source}|${row.sourceId}`, row);
  }
  return out;
}

export function requirementsOf(row: JobRow): Requirements {
  return (row.requirements as unknown as Requirements | null) ?? parseRequirements(row.description);
}

/** The posting's keyword phrases (stored at ingest; older rows are read on the fly). */
export function keywordsOf(row: Pick<JobRow, "keywords" | "description">): string[] {
  return row.keywords ?? extractKeywords(row.description);
}

export async function saveMatches(userId: string, scored: Array<{ job: JobRow; fit: FitReport }>, savedSearchId?: string) {
  if (!scored.length) return;

  for (let i = 0; i < scored.length; i += MATCH_CHUNK) {
    const chunk = scored.slice(i, i + MATCH_CHUNK).map(({ job, fit }) => {
      const fitJson = {
        score: fit.score,
        raw: fit.raw,
        cappedBy: fit.cappedBy,
        points: fit.points,
        details: fit.details,
        strengths: fit.strengths,
        gaps: fit.gaps,
      } as unknown as Record<string, unknown>;
      return {
        userId,
        jobId: job.id,
        fitScore: fit.score,
        fit: fitJson,
        savedSearchId: savedSearchId ?? null,
      };
    });
    await db
      .insert(schema.jobMatch)
      .values(chunk)
      .onConflictDoUpdate({
        target: [schema.jobMatch.userId, schema.jobMatch.jobId],
        set: {
          fitScore: sql`excluded.fit_score`,
          fit: sql`excluded.fit`,
        },
      });
  }
}

export async function getJobForUser(userId: string, jobId: string) {
  const job = await db.query.job.findFirst({ where: eq(schema.job.id, jobId) });
  if (!job) return null;
  const match = await db.query.jobMatch.findFirst({ where: and(eq(schema.jobMatch.userId, userId), eq(schema.jobMatch.jobId, jobId)) });
  // Pasted descriptions may come from private emails or campus portals. Their
  // source ID is user-keyed, and only the account with a match may read them.
  if (job.sourceId.startsWith("pasted:") && !match) return null;
  return { job, match: match ?? null };
}

export async function listMatches(userId: string, status: Array<MatchRow["status"]> = ["new", "saved"], limit = 100) {
  const matches = await db.query.jobMatch.findMany({
    where: and(eq(schema.jobMatch.userId, userId), inArray(schema.jobMatch.status, status)),
    orderBy: [desc(schema.jobMatch.fitScore), desc(schema.jobMatch.updatedAt)],
    limit,
  });
  if (!matches.length) return [];
  const jobs = await db.query.job.findMany({ where: inArray(schema.job.id, matches.map((m) => m.jobId)) });
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return matches.flatMap((m) => (byId.has(m.jobId) ? [{ match: m, job: byId.get(m.jobId)! }] : []));
}

export async function setMatchStatus(userId: string, jobId: string, status: MatchRow["status"], dismissReason?: string) {
  if (!(await getJobForUser(userId, jobId))) throw new Error("This job is not available to your account.");
  await db
    .insert(schema.jobMatch)
    .values({ userId, jobId, status, dismissReason: dismissReason ?? null })
    .onConflictDoUpdate({ target: [schema.jobMatch.userId, schema.jobMatch.jobId], set: { status, dismissReason: dismissReason ?? null } });
}
