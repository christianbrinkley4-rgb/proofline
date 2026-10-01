import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { tidyLocation } from "@/lib/jobs/locations";
import type { LoopStep, RunStatus } from "./loop";

export type RunItem = {
  id: string;
  jobId: string;
  status: Exclude<RunStatus, "running">;
  reason: string | null;
  steps: LoopStep[];
  company: string;
  title: string;
  location: string | null;
  fit: number | null;
  resumeId: string | null;
  at: string;
};

/** What the loop has done for this person, newest first, without roles they sent away. */
export async function listRuns(userId: string): Promise<RunItem[]> {
  const rows = await db
    .select({ run: schema.agentRun, job: schema.job, fit: schema.jobMatch.fitScore })
    .from(schema.agentRun)
    .innerJoin(schema.job, eq(schema.job.id, schema.agentRun.jobId))
    .leftJoin(schema.jobMatch, and(eq(schema.jobMatch.jobId, schema.agentRun.jobId), eq(schema.jobMatch.userId, userId)))
    .where(and(eq(schema.agentRun.userId, userId), isNull(schema.agentRun.dismissedAt), ne(schema.agentRun.status, "running")))
    .orderBy(desc(schema.agentRun.updatedAt))
    .limit(100);
  return rows.map(({ run, job, fit }) => ({
    id: run.id,
    jobId: run.jobId,
    status: run.status as RunItem["status"],
    reason: run.reason,
    steps: run.steps as unknown as LoopStep[],
    company: job.company,
    title: job.title,
    location: tidyLocation(job.location),
    fit,
    resumeId: run.resumeId,
    at: run.updatedAt.toISOString(),
  }));
}
