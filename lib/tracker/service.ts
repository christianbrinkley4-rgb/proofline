import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { logEvent } from "@/lib/agent/events";
import { db, schema, type Db } from "@/lib/db";
import { ManualApplicationSchema, StageSchema, stagePatch, type Application, type Stage } from "./model";
import { REPLY_STAGE, ReplySchema } from "./activity";
export type { Application, Stage } from "./model";

export async function listApplications(userId: string): Promise<Application[]> {
  return db.query.application.findMany({ where: eq(schema.application.userId, userId), orderBy: [asc(schema.application.sortOrder), asc(schema.application.createdAt)] });
}
export async function getApplication(userId: string, id: string) {
  return db.query.application.findFirst({ where: and(eq(schema.application.id, id), eq(schema.application.userId, userId)) });
}
async function checkResume(database: Db, userId: string, id: string, jobId: string | null) {
  z.uuid().parse(id);
  const resume = await database.query.resume.findFirst({ where: and(eq(schema.resume.id, id), eq(schema.resume.userId, userId)) });
  if (!resume || (resume.jobId && resume.jobId !== jobId)) throw new Error("Choose one of your resumes for this job.");
}

/** Serializing on the user's row makes repeated clicks create only one application. */
export async function trackJob(userId: string, jobId: string, opts: { resumeId?: string; stage?: Stage } = {}): Promise<Application> {
  z.uuid().parse(jobId);
  const stage = StageSchema.parse(opts.stage ?? "saved");
  return db.transaction(async (tx) => {
    await tx.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, userId)).for("update");
    if (opts.resumeId) await checkResume(tx, userId, opts.resumeId, jobId);
    const existing = await tx.query.application.findFirst({ where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)) });
    if (existing) {
      if (opts.resumeId && opts.resumeId !== existing.resumeId) {
        if (existing.stage !== "saved" && existing.resumeId) throw new Error("The submitted resume is preserved. Change versions before applying.");
        const [updated] = await tx.update(schema.application).set({ resumeId: opts.resumeId, updatedAt: new Date() })
          .where(and(eq(schema.application.id, existing.id), eq(schema.application.userId, userId))).returning();
        await tx.insert(schema.agentEvent).values({ userId, type: "resume_linked", data: { applicationId: existing.id, resumeId: opts.resumeId } });
        return updated;
      }
      return existing;
    }
    const job = await tx.query.job.findFirst({ where: eq(schema.job.id, jobId) });
    if (!job) throw new Error("Job not found");
    const now = new Date();
    const patch = stagePatch({ stage: "saved", appliedAt: null, sortOrder: now.getTime() }, stage, now);
    const [row] = await tx.insert(schema.application).values({
      ...patch, userId, jobId, company: job.company, title: job.title, url: job.url, stage,
      resumeId: opts.resumeId ?? null, sortOrder: now.getTime(),
    }).returning();
    await tx.insert(schema.agentEvent).values({ userId, type: "application_stage_changed", data: { applicationId: row.id, from: null, to: stage, jobId, resumeId: row.resumeId } });
    if (row.resumeId) await tx.insert(schema.agentEvent).values({ userId, type: "resume_linked", data: { applicationId: row.id, resumeId: row.resumeId } });
    return row;
  });
}
export async function addManualApplication(userId: string, input: { company: string; title: string; url?: string; stage?: Stage }) {
  const parsed = ManualApplicationSchema.parse(input);
  const now = new Date();
  const stage = parsed.stage ?? "saved";
  const patch = stagePatch({ stage: "saved", appliedAt: null, sortOrder: now.getTime() }, stage, now);
  const [row] = await db.insert(schema.application).values({ ...patch, ...parsed, userId, stage, sortOrder: now.getTime() }).returning();
  await logEvent(userId, "application_stage_changed", { applicationId: row.id, from: null, to: stage });
  return row;
}
export async function moveApplication(userId: string, id: string, stage: Stage, sortOrder?: number) {
  z.uuid().parse(id);
  StageSchema.parse(stage);
  if (sortOrder !== undefined) z.number().finite().parse(sortOrder);
  return db.transaction(async (tx) => {
    const [app] = await tx.select().from(schema.application).where(and(eq(schema.application.id, id), eq(schema.application.userId, userId))).for("update");
    if (!app) throw new Error("Application not found");
    await tx.update(schema.application).set(stagePatch(app, stage, new Date(), sortOrder)).where(and(eq(schema.application.id, id), eq(schema.application.userId, userId)));
    if (stage !== app.stage) await tx.insert(schema.agentEvent).values({
      userId, type: "application_stage_changed",
      data: { applicationId: id, from: app.stage, to: stage, jobId: app.jobId, resumeId: app.resumeId },
    });
  });
}
export async function updateApplication(userId: string, id: string, patch: Partial<Pick<Application, "notes" | "contacts" | "nextFollowUpAt" | "deadline">>) {
  const app = await getApplication(userId, id);
  if (!app) throw new Error("Application not found");
  await db.update(schema.application).set({ ...patch, updatedAt: new Date() }).where(and(eq(schema.application.id, id), eq(schema.application.userId, userId)));
}

/** The user records an actual reply. A concrete outcome also advances the stage. */
export async function recordReply(userId: string, id: string, input: { kind: string; summary: string }) {
  z.uuid().parse(id);
  const reply = ReplySchema.parse(input);
  return db.transaction(async (tx) => {
    const [app] = await tx.select().from(schema.application).where(and(eq(schema.application.id, id), eq(schema.application.userId, userId))).for("update");
    if (!app || !app.appliedAt) throw new Error("Apply before recording a reply.");
    const now = new Date();
    await tx.insert(schema.agentEvent).values({
      userId, type: "application_reply_recorded",
      data: { applicationId: id, kind: reply.kind, summary: reply.summary },
    });
    const stage = REPLY_STAGE[reply.kind];
    if (stage && stage !== app.stage) {
      await tx.update(schema.application).set(stagePatch(app, stage, now)).where(and(eq(schema.application.id, id), eq(schema.application.userId, userId)));
      await tx.insert(schema.agentEvent).values({
        userId, type: "application_stage_changed",
        data: { applicationId: id, from: app.stage, to: stage, jobId: app.jobId, resumeId: app.resumeId },
      });
    }
  });
}

/** Removing an application also removes its private activity and email drafts. */
export async function deleteApplication(userId: string, id: string) {
  z.uuid().parse(id);
  await db.transaction(async (tx) => {
    const events = await tx.query.agentEvent.findMany({ where: eq(schema.agentEvent.userId, userId), columns: { id: true, data: true } });
    const eventIds = events.filter((event) => event.data.applicationId === id).map((event) => event.id);
    if (eventIds.length) await tx.delete(schema.agentEvent).where(and(eq(schema.agentEvent.userId, userId), inArray(schema.agentEvent.id, eventIds)));
    await tx.delete(schema.application).where(and(eq(schema.application.id, id), eq(schema.application.userId, userId)));
  });
}
