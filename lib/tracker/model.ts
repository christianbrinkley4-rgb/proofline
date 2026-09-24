import { z } from "zod";
import type { application } from "@/lib/db/schema";

export type Application = typeof application.$inferSelect;
export const STAGES = ["saved", "applied", "assessment", "interview", "offer", "rejected"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  saved: "Saved", applied: "Applied", assessment: "Assessment", interview: "Interview", offer: "Offer", rejected: "Rejected",
};
export const StageSchema = z.enum(STAGES);
export const FOLLOW_UP_DAYS = 7;
export const HttpUrl = z.string().url().max(2000).refine((value) => ["https:", "http:"].includes(new URL(value).protocol), "Use an http or https link.");
export const ManualApplicationSchema = z.object({
  company: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(200),
  url: HttpUrl.optional(),
  stage: StageSchema.optional(),
});
export const NoteSchema = z.object({
  notes: z.string().max(5000).optional(),
  contacts: z.array(z.object({
    name: z.string().trim().min(1).max(160),
    role: z.string().max(160).optional(),
    email: z.union([z.literal(""), z.string().email().max(254)]).optional(),
  })).max(10).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(value + "T12:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Use a valid date.").nullable().optional(),
});

export function stagePatch(app: Pick<Application, "stage" | "appliedAt" | "sortOrder">, stage: Stage, now = new Date(), sortOrder?: number): Partial<Application> {
  const patch: Partial<Application> = { stage, sortOrder: sortOrder ?? app.sortOrder, updatedAt: now };
  if (stage === app.stage) return patch;
  patch.stageChangedAt = now;
  patch.nextFollowUpAt = stage === "applied" ? new Date(now.getTime() + FOLLOW_UP_DAYS * 864e5) : null;
  if (stage !== "saved" && !app.appliedAt && stage !== "rejected") patch.appliedAt = now;
  return patch;
}

export function trackerStats(apps: Application[], now = new Date()) {
  const applied = apps.filter((a) => a.appliedAt != null || ["applied", "assessment", "interview", "offer"].includes(a.stage));
  return {
    applications: applied.length,
    interviews: apps.filter((a) => a.stage === "interview" || a.stage === "offer").length,
    offers: apps.filter((a) => a.stage === "offer").length,
    dueFollowUps: apps.filter((a) => a.stage === "applied" && a.nextFollowUpAt && a.nextFollowUpAt <= now).length,
  };
}

/** Draft only. Never sends email or claims an interview that wasn't recorded. */
export function followUpDraft(app: Pick<Application, "company" | "title" | "stage" | "contacts">, name: string) {
  const contact = app.contacts?.[0]?.name?.trim();
  const greeting = contact ? "Hi " + contact + "," : "Hello,";
  const subject = "Following up: " + app.title + " at " + app.company;
  const body = [
    greeting, "",
    "I'm following up on my application for the " + app.title + " role at " + app.company + ".",
    "I'm still interested in the opportunity and would appreciate any update on the next steps or hiring timeline.",
    "Please let me know if there is anything else I can provide.", "", "Thank you,", name || "[Your name]",
  ].join("\n");
  return { subject, body };
}

export function safeJobUrl(value: string | null): string | null {
  if (!value) return null;
  return HttpUrl.safeParse(value).success ? value : null;
}

