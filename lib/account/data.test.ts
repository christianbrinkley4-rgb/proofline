import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { createExperience } from "@/lib/kb/experiences";
import { addFact, reviseFact } from "@/lib/kb/facts";
import { ensureProfile } from "@/lib/kb/profile";
import { createStoryNote } from "@/lib/kb/story";
import { createToken } from "@/lib/agent/tokens";
import { recordCareerCheckin, setCareerGoal } from "@/lib/career/service";
import { deleteAccount, exportAccount } from "./data";

const userId = "test-user-account";

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values({ id: userId, name: "Delete Me", email: "delete-me@example.com" }).onConflictDoNothing();
  await ensureProfile(userId, "Delete Me");
  const exp = await createExperience(userId, { kind: "work", org: "Campus Dining" });
  const fact = await addFact(userId, { content: "Trained 4 new hires", category: "leadership", experienceId: exp.id, source: "user_stated" });
  await reviseFact(userId, fact.id, { content: "Trained 5 new hires" });
  await createStoryNote(userId, { body: "Ran the closing checklist on weekends" });
  await createToken(userId, "Claude");
  const goal = await setCareerGoal(userId, { targetRole: "Explore career directions", targetMonth: null, motivation: "I am learning what fits", benchmarkJobId: null });
  await recordCareerCheckin(userId, goal.id, "A volunteer shift helped me compare options.");
  // A pasted job with its match, a resume, an application, feedback, and a funnel event.
  const [job] = await db.insert(schema.job).values({ source: "link", sourceId: "pasted:delete-me-test", company: "Acme", companySlug: "acme", title: "Clerk", url: "", description: "Private pasted text", dedupeKey: "acme|clerk|delete-me" }).returning();
  await db.insert(schema.jobMatch).values({ userId, jobId: job.id, status: "saved" });
  const [resume] = await db.insert(schema.resume).values({ userId, jobId: job.id, name: "Clerk at Acme", template: "classic", variant: "experience", content: {} }).returning();
  await db.insert(schema.application).values({ userId, jobId: job.id, company: "Acme", title: "Clerk", resumeId: resume.id });
  await db.insert(schema.inboxMessage).values({ userId, kind: "feedback", message: "The review was clear." });
  await db.insert(schema.agentEvent).values({ userId, type: "exported", data: {} });
  jobId = job.id;
}, 60_000);

let jobId = "";

describe("account data", () => {
  it("exports every version of every fact, without token secrets", async () => {
    const data = await exportAccount(userId);
    expect(data.user?.email).toBe("delete-me@example.com");
    expect(data.facts.map((f) => f.content).sort()).toEqual(["Trained 4 new hires", "Trained 5 new hires"]);
    expect(data.storyNotes).toHaveLength(1);
    expect(data.careerGoals[0].targetRole).toBe("Explore career directions");
    expect(data.careerCheckins.some((entry) => entry.reflection?.includes("volunteer shift"))).toBe(true);
    expect(data.connections[0]).not.toHaveProperty("tokenHash");
  });

  it("deletes the account and everything tied to it", async () => {
    await deleteAccount(userId);
    const [user, facts, notes, tokens, profile, goals, checkins] = await Promise.all([
      db.query.user.findFirst({ where: eq(schema.user.id, userId) }),
      db.query.fact.findMany({ where: eq(schema.fact.userId, userId) }),
      db.query.storyNote.findMany({ where: eq(schema.storyNote.userId, userId) }),
      db.query.apiToken.findMany({ where: eq(schema.apiToken.userId, userId) }),
      db.query.profile.findFirst({ where: eq(schema.profile.userId, userId) }),
      db.query.careerGoal.findMany({ where: eq(schema.careerGoal.userId, userId) }),
      db.query.careerCheckin.findMany({ where: eq(schema.careerCheckin.userId, userId) }),
    ]);
    expect(user).toBeUndefined();
    expect(facts).toEqual([]);
    expect(notes).toEqual([]);
    expect(tokens).toEqual([]);
    expect(profile).toBeUndefined();
    expect(goals).toEqual([]);
    expect(checkins).toEqual([]);
    const [jobs, matches, resumes, applications, inbox, events] = await Promise.all([
      db.query.job.findMany({ where: eq(schema.job.id, jobId) }),
      db.query.jobMatch.findMany({ where: eq(schema.jobMatch.userId, userId) }),
      db.query.resume.findMany({ where: eq(schema.resume.userId, userId) }),
      db.query.application.findMany({ where: eq(schema.application.userId, userId) }),
      db.query.inboxMessage.findMany({ where: eq(schema.inboxMessage.userId, userId) }),
      db.query.agentEvent.findMany({ where: eq(schema.agentEvent.userId, userId) }),
    ]);
    expect({ jobs, matches, resumes, applications, inbox, events }).toEqual({ jobs: [], matches: [], resumes: [], applications: [], inbox: [], events: [] });
  });
});
