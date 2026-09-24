import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getProfile, updateProfile } from "@/lib/kb/profile";
import { logEvent } from "./events";
import { suggestPreferences, type Dismissal, type Suggestion } from "./learn";

/** Preference suggestions from the last few months of dismissals, minus any already answered. */
export async function preferenceSuggestions(userId: string, now = new Date()): Promise<Suggestion[]> {
  const since = new Date(now.getTime() - 120 * 864e5);
  const [profile, dismissals, answers] = await Promise.all([
    getProfile(userId),
    db.query.agentEvent.findMany({
      where: and(eq(schema.agentEvent.userId, userId), eq(schema.agentEvent.type, "job_dismissed"), gte(schema.agentEvent.createdAt, since)),
      orderBy: [desc(schema.agentEvent.createdAt)],
      limit: 200,
    }),
    db.query.agentEvent.findMany({ where: and(eq(schema.agentEvent.userId, userId), eq(schema.agentEvent.type, "preference_learned")) }),
  ]);
  if (!profile || dismissals.length === 0) return [];
  const jobIds = [...new Set(dismissals.map((d) => d.data.jobId).filter((id): id is string => typeof id === "string"))];
  const jobs = jobIds.length
    ? await db.query.job.findMany({ where: inArray(schema.job.id, jobIds), columns: { id: true, payMax: true, payPeriod: true, mode: true, company: true, title: true, location: true } })
    : [];
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const items: Dismissal[] = dismissals.map((d) => {
    const job = typeof d.data.jobId === "string" ? byId.get(d.data.jobId) : undefined;
    return {
      reason: str(d.data.reason),
      company: job?.company ?? str(d.data.company),
      title: job?.title ?? str(d.data.title),
      mode: job?.mode ?? str(d.data.mode),
      location: job?.location ?? str(d.data.location),
      payMax: job?.payMax ?? null,
      payPeriod: job?.payPeriod ?? null,
    };
  });
  const answered = new Set(answers.map((a) => str(a.data.key)).filter((k): k is string => Boolean(k)));
  return suggestPreferences(items, profile, answered);
}

/** The student said yes: apply exactly what the suggestion described. */
export async function acceptSuggestion(userId: string, key: string): Promise<Suggestion | null> {
  const suggestion = (await preferenceSuggestions(userId)).find((s) => s.key === key);
  if (!suggestion) return null;
  await updateProfile(userId, suggestion.patch);
  await logEvent(userId, "preference_learned", { key, accepted: true, patch: suggestion.patch });
  return suggestion;
}

/** The student said no; don't ask again. */
export async function declineSuggestion(userId: string, key: string) {
  await logEvent(userId, "preference_learned", { key, accepted: false });
}
