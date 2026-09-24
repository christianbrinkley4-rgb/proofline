import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Everything Proofline stores about one person, for "download my data", and the
 * one-step account deletion. Shared job postings aren't personal data and stay.
 */

export async function exportAccount(userId: string) {
  const [user, profile, experiences, facts, bullets, questions, storyNotes, matches, savedSearches, resumes, applications, packets, chat, events, tokens] =
    await Promise.all([
      db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { id: true, name: true, email: true, createdAt: true } }),
      db.query.profile.findFirst({ where: eq(schema.profile.userId, userId) }),
      db.query.experience.findMany({ where: eq(schema.experience.userId, userId) }),
      // Every version of every fact, including corrections and rejections.
      db.query.fact.findMany({ where: eq(schema.fact.userId, userId) }),
      db.query.bullet.findMany({ where: eq(schema.bullet.userId, userId) }),
      db.query.question.findMany({ where: eq(schema.question.userId, userId) }),
      db.query.storyNote.findMany({ where: eq(schema.storyNote.userId, userId) }),
      db.query.jobMatch.findMany({ where: eq(schema.jobMatch.userId, userId) }),
      db.query.savedSearch.findMany({ where: eq(schema.savedSearch.userId, userId) }),
      db.query.resume.findMany({ where: eq(schema.resume.userId, userId) }),
      db.query.application.findMany({ where: eq(schema.application.userId, userId) }),
      db.query.applicationPacket.findMany({ where: eq(schema.applicationPacket.userId, userId) }),
      db.query.chatMessage.findMany({ where: eq(schema.chatMessage.userId, userId) }),
      db.query.agentEvent.findMany({ where: eq(schema.agentEvent.userId, userId) }),
      db.query.apiToken.findMany({ where: eq(schema.apiToken.userId, userId), columns: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true } }),
    ]);
  const jobIds = [...new Set([...matches.map((m) => m.jobId), ...applications.flatMap((a) => (a.jobId ? [a.jobId] : []))])];
  const jobs = jobIds.length
    ? await db.query.job.findMany({ where: inArray(schema.job.id, jobIds), columns: { id: true, company: true, title: true, location: true, url: true, postedAt: true } })
    : [];
  return {
    exportedAt: new Date().toISOString(),
    format: "proofline-export-v1",
    user,
    profile,
    experiences,
    facts,
    bullets,
    questions,
    storyNotes,
    jobs,
    jobMatches: matches,
    savedSearches,
    resumes,
    applications,
    applicationPackets: packets,
    chat,
    activity: events,
    connections: tokens,
  };
}

/** Removes the account and everything tied to it (the schema cascades from the user row). */
export async function deleteAccount(userId: string) {
  await db.delete(schema.user).where(eq(schema.user.id, userId));
}
