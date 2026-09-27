import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";

export const FeedbackInput = z.object({
  kind: z.enum(["resume", "cover_letter", "career_plan", "job_coaching"]),
  subjectId: z.uuid(),
  rating: z.enum(["helpful", "partly_helpful", "not_helpful"]),
  issue: z.enum(["unsupported_claim", "generic", "irrelevant", "unrealistic_step", "hard_to_use", "other"]).nullable().optional(),
  comment: z.string().trim().max(1000).nullable().optional(),
  consentToImprove: z.boolean().default(false),
});

export type FeedbackInput = z.input<typeof FeedbackInput>;

/**
 * Records a person's assessment of one output. A rating is self-reported product
 * feedback, never evidence that an employer accepted the document.
 * The same account can use its feedback to revise advice. Consent permits future
 * cross-user product review; no shared training pipeline runs here. The exact
 * document stays in its original table, and this event stores no copy.
 */
export async function submitFeedback(userId: string, raw: FeedbackInput) {
  const input = FeedbackInput.parse(raw);
  let jobId: string | null = null;
  let resumeId: string | null = null;
  let artifactHash: string | null = null;
  if (input.kind === "resume") {
    const resume = await db.query.resume.findFirst({
      where: and(eq(schema.resume.id, input.subjectId), eq(schema.resume.userId, userId)),
    });
    if (!resume) throw new Error("Resume not found on this account.");
    resumeId = resume.id;
    jobId = resume.jobId;
    artifactHash = createHash("sha256").update(JSON.stringify({ template: resume.template, variant: resume.variant, content: resume.content })).digest("hex");
  } else if (input.kind === "cover_letter") {
    const packet = await db.query.applicationPacket.findFirst({
      where: and(eq(schema.applicationPacket.jobId, input.subjectId), eq(schema.applicationPacket.userId, userId)),
    });
    if (!packet?.coverLetter) throw new Error("Cover letter not found on this account.");
    jobId = packet.jobId;
    artifactHash = createHash("sha256").update(JSON.stringify(packet.coverLetter)).digest("hex");
  } else if (input.kind === "career_plan") {
    const goal = await db.query.careerGoal.findFirst({
      where: and(eq(schema.careerGoal.id, input.subjectId), eq(schema.careerGoal.userId, userId)),
    });
    if (!goal) throw new Error("Career plan not found on this account.");
    jobId = goal.benchmarkJobId;
  } else {
    const [match, application] = await Promise.all([
      db.query.jobMatch.findFirst({
        where: and(eq(schema.jobMatch.jobId, input.subjectId), eq(schema.jobMatch.userId, userId)),
      }),
      db.query.application.findFirst({
        where: and(eq(schema.application.jobId, input.subjectId), eq(schema.application.userId, userId)),
      }),
    ]);
    if (!match && !application) throw new Error("Job coaching not found on this account.");
    jobId = input.subjectId;
  }
  const [event] = await db.insert(schema.agentEvent).values({
    userId,
    type: "product_feedback",
    data: {
      kind: input.kind,
      subjectId: input.subjectId,
      jobId,
      resumeId,
      artifactHash,
      rating: input.rating,
      issue: input.issue ?? null,
      comment: input.comment || null,
      consentToImprove: input.consentToImprove,
      outcomeEvidence: false,
    },
  }).returning();
  return event;
}

export async function listFeedback(userId: string, limit = 20) {
  return db.query.agentEvent.findMany({
    where: and(eq(schema.agentEvent.userId, userId), eq(schema.agentEvent.type, "product_feedback")),
    orderBy: [desc(schema.agentEvent.createdAt)],
    limit: Math.min(50, Math.max(1, limit)),
  });
}

export async function deleteFeedback(userId: string, feedbackId: string) {
  z.uuid().parse(feedbackId);
  const [removed] = await db.delete(schema.agentEvent).where(and(
    eq(schema.agentEvent.id, feedbackId),
    eq(schema.agentEvent.userId, userId),
    eq(schema.agentEvent.type, "product_feedback"),
  )).returning({ id: schema.agentEvent.id });
  if (!removed) throw new Error("Feedback not found on this account.");
}