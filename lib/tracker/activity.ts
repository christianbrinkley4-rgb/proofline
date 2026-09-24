import { z } from "zod";
import { STAGE_LABEL, StageSchema, type Stage } from "./model";

export const ReplySchema = z.object({
  kind: z.enum(["update", "assessment", "interview", "offer", "rejection"]),
  summary: z.string().trim().min(2, "Add a short note about the reply.").max(3000),
});
export type ReplyKind = z.infer<typeof ReplySchema>["kind"];
export const REPLY_LABEL: Record<ReplyKind, string> = {
  update: "General update",
  assessment: "Assessment invitation",
  interview: "Interview invitation",
  offer: "Offer",
  rejection: "Rejection",
};
export const REPLY_STAGE: Partial<Record<ReplyKind, Stage>> = {
  assessment: "assessment",
  interview: "interview",
  offer: "offer",
  rejection: "rejected",
};

export type ApplicationActivity = {
  id: string;
  applicationId: string;
  at: string;
  type: "stage" | "resume" | "followup" | "reply";
  title: string;
  detail: string | null;
  subject?: string;
  body?: string;
};
type EventRecord = { id: string; type: string; data: Record<string, unknown>; createdAt: Date };

/** Reads both new and legacy events without trusting arbitrary event payloads as labels. */
export function parseApplicationActivity(events: EventRecord[]): ApplicationActivity[] {
  const items: ApplicationActivity[] = [];
  for (const event of events) {
    const data = event.data;
    if (typeof data.applicationId !== "string") continue;
    const base = { id: event.id, applicationId: data.applicationId, at: event.createdAt.toISOString() };
    if (event.type === "application_stage_changed") {
      const to = StageSchema.safeParse(data.to);
      if (!to.success) continue;
      const from = StageSchema.safeParse(data.from);
      items.push({
        ...base, type: "stage",
        title: from.success ? "Moved to " + STAGE_LABEL[to.data] : (to.data === "saved" ? "Saved opportunity" : "Recorded as " + STAGE_LABEL[to.data]),
        detail: from.success ? "Previously " + STAGE_LABEL[from.data] + "." : null,
      });
    } else if (event.type === "resume_linked" && typeof data.resumeId === "string") {
      items.push({ ...base, type: "resume", title: "Linked a resume version", detail: null });
    } else if (event.type === "follow_up_recorded" && typeof data.subject === "string" && typeof data.body === "string") {
      items.push({ ...base, type: "followup", title: "Follow-up marked sent", detail: null, subject: data.subject, body: data.body });
    } else if (event.type === "application_reply_recorded") {
      const kind = ReplySchema.shape.kind.safeParse(data.kind);
      if (!kind.success || typeof data.summary !== "string") continue;
      items.push({ ...base, type: "reply", title: REPLY_LABEL[kind.data] + " recorded", detail: data.summary });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
