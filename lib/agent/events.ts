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
  | "suggestion_answered"
  | "bullet_edited"
  | "bullet_favorited"
  | "job_saved"
  | "job_dismissed"
  | "search_run"
  | "resume_tailored"
  | "resume_exported"
  | "application_stage_changed"
  | "application_reply_recorded"
  | "resume_linked"
  | "follow_up_recorded"
  | "follow_up_drafted"
  | "cover_letter_drafted"
  | "cover_letter_edited"
  | "preference_learned"
  | "connector_call"
  | "gap_answered"
  | "gap_declined"
  // The private-beta funnel (view event_log). The owner reads these to see where testers stall.
  | "signup"
  | "job_ingested"
  | "score_viewed"
  | "tailor_completed"
  | "gate_passed"
  | "gate_failed"
  | "exported"
  | "practice_answered";

export async function logEvent(userId: string, type: AgentEventType, data: Record<string, unknown> = {}) {
  await db.insert(schema.agentEvent).values({ userId, type, data });
}
