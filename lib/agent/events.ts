import { db, schema } from "@/lib/db";

/**
 * The agent's learning signals. Every meaningful thing a user does is recorded here
 * so the agent can learn preferences, voice, and what gets responses.
 */
export type AgentEventType =
  | "fact_proposed"
  | "fact_confirmed"
  | "fact_rejected"
  | "fact_revised"
  | "question_answered"
  | "bullet_generated"
  | "bullet_edited"
  | "bullet_favorited"
  | "job_saved"
  | "job_dismissed"
  | "search_run"
  | "resume_tailored"
  | "resume_exported"
  | "application_stage_changed"
  | "follow_up_drafted"
  | "preference_learned"
  | "connector_call";

export async function logEvent(userId: string, type: AgentEventType, data: Record<string, unknown> = {}) {
  await db.insert(schema.agentEvent).values({ userId, type, data });
}
