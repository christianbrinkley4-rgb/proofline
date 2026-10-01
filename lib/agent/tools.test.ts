import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { setCareerGoal, recordCareerCheckin } from "@/lib/career/service";
import { submitFeedback } from "@/lib/feedback/service";
import { createExperience } from "@/lib/kb/experiences";
import { addFact, listFacts } from "@/lib/kb/facts";
import { askQuestion } from "@/lib/kb/questions";
import { authenticateToken, createToken, revokeToken } from "./tokens";
import { runTool, TOOLS } from "./tools";

const userId = "test-user-tools";
const ctx = { userId, email: "student@example.com", client: "Claude" };

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values({ id: userId, name: "Test Student", email: "student@example.com" }).onConflictDoNothing();
}, 60_000);

describe("agent tools", () => {
  it("describes every tool for an outside AI", () => {
    expect(TOOLS.length).toBeGreaterThan(10);
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(t.description.length).toBeGreaterThan(40);
    }
  });

  it("lets the agent read a person's goal and reflection without treating it as a resume fact", async () => {
    const empty = (await runTool("get_career_plan", {}, ctx)) as { goal: null; discovery: string };
    expect(empty.goal).toBeNull();
    expect(empty.discovery).toContain("not chosen");

    const goal = await setCareerGoal(userId, {
      targetRole: "Explore career directions", targetMonth: null,
      motivation: "I want to learn which work feels useful", benchmarkJobId: null,
    });
    await recordCareerCheckin(userId, goal.id, "I enjoyed helping a neighbor organize a community event.");
    const plan = (await runTool("get_career_plan", {}, ctx)) as {
      goal: { role: string }; recentCheckins: Array<{ reflection: string | null }>; actions: Array<{ id: string }>;
    };
    expect(plan.goal.role).toBe("Explore career directions");
    expect(plan.recentCheckins[0].reflection).toContain("community event");
    expect(plan.actions[0].id).toBe("notice-patterns");
  });
  it("reads only this person's quality feedback as self-reported advice context", async () => {
    const [resume] = await db.insert(schema.resume).values({
      userId, name: "Feedback example", template: "classic", variant: "base", content: {},
    }).returning();
    await submitFeedback(userId, {
      kind: "resume", subjectId: resume.id, rating: "not_helpful",
      issue: "generic", comment: "Make this more specific to my job.",
    });
    const otherId = "test-user-tools-feedback-other";
    await db.insert(schema.user).values({
      id: otherId, name: "Other Feedback", email: "feedback-other-tools@example.com",
    }).onConflictDoNothing();
    const [otherResume] = await db.insert(schema.resume).values({
      userId: otherId, name: "Other resume", template: "classic", variant: "base", content: {},
    }).returning();
    await submitFeedback(otherId, {
      kind: "resume", subjectId: otherResume.id, rating: "helpful", comment: "Private comment.",
    });
    const feedback = (await runTool("get_quality_feedback", {}, ctx)) as Array<{
      subjectId: string; comment: string; outcomeEvidence: boolean;
    }>;
    expect(feedback.some((entry) => entry.subjectId === resume.id && entry.comment.includes("specific"))).toBe(true);
    expect(feedback.some((entry) => entry.subjectId === otherResume.id)).toBe(false);
    expect(feedback.every((entry) => entry.outcomeEvidence === false)).toBe(true);
  });
  it("offers occupation tasks only as questions and respects profile ownership", async () => {
    const experience = await createExperience(userId, { kind: "work", org: "Local museum", title: "Museum technician" });
    const before = (await listFacts(userId)).length;
    const result = (await runTool("get_role_task_prompts", { experienceId: experience.id, count: 8 }, ctx)) as {
      prompts: Array<{ question: string; source: string }>;
      rule: string;
    };
    expect(result.prompts.length).toBeGreaterThan(0);
    expect(result.prompts.every((prompt) => prompt.question.startsWith("Have you done this work?"))).toBe(true);
    expect(result.prompts.some((prompt) => prompt.source === "O*NET 31.0")).toBe(true);
    expect(result.rule).toMatch(/not a fact/);
    expect((await listFacts(userId)).length).toBe(before);

    const otherId = "test-user-tools-other";
    await db.insert(schema.user).values({ id: otherId, name: "Other Person", email: "other-tools@example.com" }).onConflictDoNothing();
    const otherExperience = await createExperience(otherId, { kind: "work", org: "Other museum", title: "Curator" });
    await expect(runTool("get_role_task_prompts", { experienceId: otherExperience.id }, ctx)).rejects.toThrow(/not found on this profile/);
  });

  it("saves what an AI proposes as unconfirmed, credited to that AI", async () => {
    const experience = await createExperience(userId, { kind: "work", org: "Oakwood Family Dental" });
    const result = (await runTool("propose_fact", { content: "Trained two new hires on billing", category: "leadership", experienceId: experience.id }, ctx)) as { state: string };
    expect(result.state).toBe("unconfirmed");
    const [fact] = await listFacts(userId, { states: ["unconfirmed"] });
    expect(fact).toMatchObject({ source: "connector", sourceDetail: "Claude", verificationState: "unconfirmed" });
  });

  it("only returns confirmed facts unless pending ones are asked for", async () => {
    await addFact(userId, { content: "Reconciled 40 vendor accounts a month", category: "metric", source: "user_stated" });
    const confirmed = (await runTool("list_facts", {}, ctx)) as Array<{ state: string }>;
    expect(confirmed.every((f) => f.state === "confirmed")).toBe(true);
    const all = (await runTool("list_facts", { includePending: true }, ctx)) as Array<{ state: string }>;
    expect(all.some((f) => f.state === "unconfirmed")).toBe(true);
  });

  it("can't answer a yes/no question, and relays other answers as proposals", async () => {
    const fact = await addFact(userId, { content: "Led a 5-person team", category: "leadership", source: "resume_parsed" });
    const yesNo = await askQuestion(userId, { prompt: "Is this right?", kind: "yes_no", factId: fact.id });
    await expect(runTool("answer_question", { questionId: yesNo.id, answer: "yes" }, ctx)).rejects.toThrow(/needs the student/);
    expect((await listFacts(userId, { states: ["unconfirmed"] })).some((f) => f.id === fact.id)).toBe(true);

    const text = await askQuestion(userId, { prompt: "How many returns?", kind: "text", factTemplate: "Prepared {answer} returns", factCategory: "metric" });
    const answered = (await runTool("answer_question", { questionId: text.id, answer: "60" }, ctx)) as { factState: string };
    expect(answered.factState).toBe("unconfirmed");
  });

  it("rejects bad input before it reaches the database", async () => {
    await expect(runTool("propose_fact", { content: "x", category: "metric" }, ctx)).rejects.toThrow();
    await expect(runTool("get_job_fit", { jobId: "not-a-uuid" }, ctx)).rejects.toThrow();
    await expect(runTool("no_such_tool", {}, ctx)).rejects.toThrow(/Unknown tool/);
  });

  it("records every call as an agent event", async () => {
    await runTool("get_profile", {}, ctx);
    const events = await db.query.agentEvent.findMany({ where: (e, { and, eq }) => and(eq(e.userId, userId), eq(e.type, "connector_call")) });
    expect(events.some((e) => e.data.tool === "get_profile" && e.data.client === "Claude")).toBe(true);
  });
});

describe("access tokens", () => {
  it("authenticates a bearer token until it's revoked", async () => {
    const { token, row } = await createToken(userId, "Claude");
    expect(token.startsWith("pl_")).toBe(true);
    expect(row.tokenHash).not.toContain(token);
    expect(await authenticateToken(`Bearer ${token}`)).toMatchObject({ userId, name: "Claude" });
    expect(await authenticateToken(`Bearer ${token}x`)).toBeNull();
    expect(await authenticateToken(token)).toBeNull();
    await revokeToken(userId, row.id);
    expect(await authenticateToken(`Bearer ${token}`)).toBeNull();
  });
});
