import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { FitReport } from "@/lib/fit/engine";
import { parseRequirements, type Requirements } from "@/lib/fit/requirements";
import { dedupeKey, slugify } from "./text";
import type { NormalizedJob } from "./types";

export type JobRow = typeof schema.job.$inferSelect;
export type MatchRow = typeof schema.jobMatch.$inferSelect;

/** Inserts or refreshes postings. Returns rows keyed by `${source}|${sourceId}`. */
export async function upsertJobs(jobs: NormalizedJob[]): Promise<Map<string, JobRow>> {
  const out = new Map<string, JobRow>();
  for (const j of jobs) {
    const requirements = j.description ? parseRequirements(j.description) : null;
    const values = {
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
      fetchedAt: new Date(),
    };
    const [row] = await db
      .insert(schema.job)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.job.source, schema.job.sourceId],
        set: {
          ...values,
          // Keep a description we already fetched if this listing came without one.
          description: sql`coalesce(excluded.description, ${schema.job.description})`,
          requirements: sql`coalesce(excluded.requirements, ${schema.job.requirements})`,
        },
      })
      .returning();
    out.set(`${j.source}|${j.sourceId}`, row);
  }
  return out;
}

export function requirementsOf(row: JobRow): Requirements {
  return (row.requirements as unknown as Requirements | null) ?? parseRequirements(row.description);
}

export async function saveMatches(userId: string, scored: Array<{ job: JobRow; fit: FitReport }>, savedSearchId?: string) {
  for (const { job, fit } of scored) {
    const fitJson = {
      score: fit.score,
      raw: fit.raw,
      cappedBy: fit.cappedBy,
      points: fit.points,
      details: fit.details,
      strengths: fit.strengths,
      gaps: fit.gaps,
    } as unknown as Record<string, unknown>;
    await db
      .insert(schema.jobMatch)
      .values({ userId, jobId: job.id, fitScore: fit.score, fit: fitJson, savedSearchId: savedSearchId ?? null })
      .onConflictDoUpdate({ target: [schema.jobMatch.userId, schema.jobMatch.jobId], set: { fitScore: fit.score, fit: fitJson } });
  }
}

export async function getJobForUser(userId: string, jobId: string) {
  const job = await db.query.job.findFirst({ where: eq(schema.job.id, jobId) });
  if (!job) return null;
  const match = await db.query.jobMatch.findFirst({ where: and(eq(schema.jobMatch.userId, userId), eq(schema.jobMatch.jobId, jobId)) });
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
  await db
    .insert(schema.jobMatch)
    .values({ userId, jobId, status, dismissReason: dismissReason ?? null })
    .onConflictDoUpdate({ target: [schema.jobMatch.userId, schema.jobMatch.jobId], set: { status, dismissReason: dismissReason ?? null } });
}
