import { and, asc, eq } from "drizzle-orm";
import { logEvent } from "@/lib/agent/events";
import { db, schema } from "@/lib/db";

export type Application = typeof schema.application.$inferSelect;
export type Stage = Application["stage"];

export const STAGES: Stage[] = ["saved", "applied", "assessment", "interview", "offer", "rejected"];
export const STAGE_LABEL: Record<Stage, string> = {
  saved: "Saved",
  applied: "Applied",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

/** Days after applying before the agent suggests a follow-up. */
export const FOLLOW_UP_DAYS = 7;

export async function listApplications(userId: string): Promise<Application[]> {
  return db.query.application.findMany({
    where: eq(schema.application.userId, userId),
    orderBy: [asc(schema.application.sortOrder), asc(schema.application.createdAt)],
  });
}

export async function getApplication(userId: string, id: string) {
  return db.query.application.findFirst({ where: and(eq(schema.application.id, id), eq(schema.application.userId, userId)) });
}

/** Adds a job to the tracker (once). Returns the existing card if it's already there. */
export async function trackJob(userId: string, jobId: string, opts: { resumeId?: string; stage?: Stage } = {}): Promise<Application> {
  const existing = await db.query.application.findFirst({
    where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)),
  });
  if (existing) {
    if (opts.resumeId && !existing.resumeId) {
      const [row] = await db.update(schema.application).set({ resumeId: opts.resumeId }).where(eq(schema.application.id, existing.id)).returning();
      return row;
    }
    return existing;
  }
  const job = await db.query.job.findFirst({ where: eq(schema.job.id, jobId) });
  if (!job) throw new Error("Job not found");
  const [row] = await db
    .insert(schema.application)
    .values({
      userId,
      jobId,
      company: job.company,
      title: job.title,
      url: job.url,
      stage: opts.stage ?? "saved",
      resumeId: opts.resumeId ?? null,
      sortOrder: Date.now(),
    })
    .returning();
  await logEvent(userId, "application_stage_changed", { applicationId: row.id, from: null, to: row.stage, jobId });
  return row;
}

export async function addManualApplication(userId: string, input: { company: string; title: string; url?: string; stage?: Stage }) {
  const [row] = await db
    .insert(schema.application)
    .values({ userId, company: input.company, title: input.title, url: input.url ?? null, stage: input.stage ?? "saved", sortOrder: Date.now() })
    .returning();
  return row;
}

/**
 * Moves a card. Every move is an outcome signal the agent learns from:
 * which resume version, template, and kind of job got a response.
 */
export async function moveApplication(userId: string, id: string, stage: Stage, sortOrder?: number) {
  const app = await getApplication(userId, id);
  if (!app) return;
  const now = new Date();
  const patch: Partial<Application> = { stage, sortOrder: sortOrder ?? app.sortOrder };
  if (stage !== app.stage) {
    patch.stageChangedAt = now;
    if (stage === "applied" && !app.appliedAt) {
      patch.appliedAt = now;
      patch.nextFollowUpAt = new Date(now.getTime() + FOLLOW_UP_DAYS * 864e5);
    }
    if (stage !== "applied") patch.nextFollowUpAt = null;
  }
  await db.update(schema.application).set(patch).where(eq(schema.application.id, id));
  if (stage !== app.stage) {
    await logEvent(userId, "application_stage_changed", {
      applicationId: id,
      from: app.stage,
      to: stage,
      jobId: app.jobId,
      resumeId: app.resumeId,
      daysSinceApplied: app.appliedAt ? Math.round((now.getTime() - app.appliedAt.getTime()) / 864e5) : null,
    });
  }
}

export async function updateApplication(userId: string, id: string, patch: Partial<Pick<Application, "notes" | "contacts" | "nextFollowUpAt" | "deadline" | "resumeId">>) {
  await db.update(schema.application).set(patch).where(and(eq(schema.application.id, id), eq(schema.application.userId, userId)));
}

export async function deleteApplication(userId: string, id: string) {
  await db.delete(schema.application).where(and(eq(schema.application.id, id), eq(schema.application.userId, userId)));
}

export function trackerStats(apps: Application[]) {
  const applied = apps.filter((a) => a.stage !== "saved");
  const responded = applied.filter((a) => ["assessment", "interview", "offer"].includes(a.stage) || (a.stage === "rejected" && a.appliedAt));
  const interviews = apps.filter((a) => a.stage === "interview" || a.stage === "offer").length;
  const dueFollowUps = apps.filter((a) => a.stage === "applied" && a.nextFollowUpAt && a.nextFollowUpAt.getTime() <= Date.now()).length;
  return {
    applications: applied.length,
    responseRate: applied.length ? Math.round((responded.length / applied.length) * 100) : 0,
    interviews,
    offers: apps.filter((a) => a.stage === "offer").length,
    dueFollowUps,
  };
}
