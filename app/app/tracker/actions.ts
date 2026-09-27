"use server";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { NoteSchema, ManualApplicationSchema, StageSchema, type Stage } from "@/lib/tracker/model";
import { ReplySchema } from "@/lib/tracker/activity";
import { addManualApplication, deleteApplication, getApplication, moveApplication, recordReply, trackJob, updateApplication } from "@/lib/tracker/service";

const Id = z.uuid();
function refresh() { revalidatePath("/app/tracker"); revalidatePath("/app"); }
export async function trackJobAction(jobId: string, resumeId?: string) {
  const session = await requireSession();
  await trackJob(session.user.id, Id.parse(jobId), { resumeId: resumeId ? Id.parse(resumeId) : undefined });
  refresh();
}
export async function moveApplicationAction(id: string, stage: Stage, sortOrder?: number) {
  const session = await requireSession();
  await moveApplication(session.user.id, Id.parse(id), StageSchema.parse(stage), sortOrder);
  refresh();
}
export async function updateApplicationAction(id: string, patch: z.infer<typeof NoteSchema>) {
  const session = await requireSession();
  await updateApplication(session.user.id, Id.parse(id), NoteSchema.parse(patch));
  refresh();
}
export async function addManualApplicationAction(input: z.infer<typeof ManualApplicationSchema>) {
  const session = await requireSession();
  const row = await addManualApplication(session.user.id, ManualApplicationSchema.parse(input));
  refresh();
  return { id: row.id };
}
export async function recordReplyAction(id: string, input: { kind: string; summary: string; whatHelped?: string; nextTime?: string; consentToImprove?: boolean }) {
  const session = await requireSession();
  await recordReply(session.user.id, Id.parse(id), ReplySchema.parse(input));
  refresh();
}
export async function deleteApplicationAction(id: string) {
  const session = await requireSession();
  await deleteApplication(session.user.id, Id.parse(id));
  refresh();
}
export async function snoozeFollowUpAction(id: string, days: number) {
  const session = await requireSession();
  Id.parse(id);
  z.number().int().min(1).max(90).parse(days);
  const app = await getApplication(session.user.id, id);
  if (!app || app.stage !== "applied") throw new Error("Only applied roles have follow-up reminders.");
  await updateApplication(session.user.id, id, { nextFollowUpAt: new Date(Date.now() + days * 864e5) });
  refresh();
}


export async function recordFollowUpAction(id: string, draft: { subject: string; body: string }) {
  const session = await requireSession();
  Id.parse(id);
  const clean = z.object({ subject: z.string().trim().min(1).max(300), body: z.string().trim().min(1).max(5000) }).parse(draft);
  await db.transaction(async (tx) => {
    const [app] = await tx.select().from(schema.application).where(and(eq(schema.application.id, id), eq(schema.application.userId, session.user.id))).for("update");
    if (!app || !app.appliedAt) throw new Error("Apply before recording a follow-up.");
    await tx.insert(schema.agentEvent).values({
      userId: session.user.id, type: "follow_up_recorded",
      data: { applicationId: id, subject: clean.subject, body: clean.body, recordedByUser: true },
    });
    if (app.stage === "applied") await tx.update(schema.application).set({ nextFollowUpAt: new Date(Date.now() + 7 * 864e5), updatedAt: new Date() }).where(and(eq(schema.application.id, id), eq(schema.application.userId, session.user.id)));
  });
  refresh();
}
