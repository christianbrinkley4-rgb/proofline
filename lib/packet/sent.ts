import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { logEvent } from "@/lib/agent/events";
import { db, schema } from "@/lib/db";
import { moveApplication, trackJob } from "@/lib/tracker/service";
import { KIT_VERSION } from "./kit";
import { loadAnswerKit } from "./kit-service";
import type { SentRecord } from "./sent-record";
export { readSent, sentSummary, type SentRecord } from "./sent-record";

export type MarkSubmittedResult = { ok: true; applicationId: string } | { ok: false; reason: "stale" | "already" };

/**
 * The person says they submitted on the employer's site. Proofline tracks the job if needed,
 * moves it to Applied, and keeps the kit. `digest` is the kit the page showed; if the facts
 * changed since, nothing is saved and the page shows the current kit first.
 */
export async function markSubmitted(userId: string, jobId: string, digest: string, signature = ""): Promise<MarkSubmittedResult> {
  z.uuid().parse(jobId);
  z.string().regex(/^[0-9a-f]{32}$/).parse(digest);
  const loaded = await loadAnswerKit(userId, jobId, signature);
  if (!loaded) throw new Error("Job not found.");
  if (loaded.kit.digest !== digest) return { ok: false, reason: "stale" };
  if (loaded.application?.sent) return { ok: false, reason: "already" };

  const app = await trackJob(userId, jobId, loaded.resumeId && !loaded.application ? { resumeId: loaded.resumeId } : {});
  const record: SentRecord = { version: KIT_VERSION, at: new Date().toISOString(), resumeId: loaded.resumeId, kit: loaded.kit };
  const [saved] = await db
    .update(schema.application)
    .set({ sent: record as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(and(eq(schema.application.id, app.id), eq(schema.application.userId, userId), isNull(schema.application.sent)))
    .returning({ id: schema.application.id });
  if (!saved) return { ok: false, reason: "already" };
  if (app.stage === "saved") await moveApplication(userId, app.id, "applied");
  await logEvent(userId, "kit_sent", { applicationId: app.id, jobId, blank: loaded.kit.blankCount, resumeId: loaded.resumeId });
  return { ok: true, applicationId: app.id };
}
