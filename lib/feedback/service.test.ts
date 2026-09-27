import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { exportAccount } from "@/lib/account/data";
import { db, dbReady, schema } from "@/lib/db";
import { deleteFeedback, listFeedback, submitFeedback } from "./service";

const userId = randomUUID();
const otherId = randomUUID();
let resumeId: string;
let goalId: string;

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values([
    { id: userId, name: "Beta Tester", email: "feedback-" + userId + "@example.invalid" },
    { id: otherId, name: "Other Tester", email: "feedback-" + otherId + "@example.invalid" },
  ]);
  const [resume] = await db.insert(schema.resume).values({
    userId, name: "General resume", template: "classic", variant: "base", content: {},
  }).returning();
  resumeId = resume.id;
  const [goal] = await db.insert(schema.careerGoal).values({
    userId, targetRole: "Explore career directions",
  }).returning();
  goalId = goal.id;
}, 60_000);

describe("beta product feedback", () => {
  it("accepts a rating only for an output owned by the account", async () => {
    await expect(submitFeedback(otherId, {
      kind: "resume", subjectId: resumeId, rating: "not_helpful",
    })).rejects.toThrow("not found on this account");
    await expect(submitFeedback(userId, {
      kind: "resume", subjectId: resumeId, rating: "helpful", comment: "x".repeat(1001),
    })).rejects.toThrow();
    const event = await submitFeedback(userId, {
      kind: "resume", subjectId: resumeId, rating: "partly_helpful",
      issue: "generic", comment: "The summary felt broad.",
    });
    expect(event.data.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.data).toMatchObject({
      kind: "resume", subjectId: resumeId, resumeId,
      rating: "partly_helpful", issue: "generic",
      consentToImprove: false, outcomeEvidence: false,
    });
  });

  it("keeps improvement consent explicit and feedback in account export", async () => {
    const event = await submitFeedback(userId, {
      kind: "career_plan", subjectId: goalId, rating: "helpful",
      comment: "The small experiment was realistic.", consentToImprove: true,
    });
    expect(event.data).toMatchObject({ consentToImprove: true, outcomeEvidence: false });
    expect((await listFeedback(userId)).some((entry) => entry.id === event.id)).toBe(true);
    const exported = await exportAccount(userId);
    expect(exported.activity.some((entry) => entry.id === event.id)).toBe(true);
    await expect(deleteFeedback(otherId, event.id)).rejects.toThrow("not found on this account");
    await deleteFeedback(userId, event.id);
    expect((await listFeedback(userId)).some((entry) => entry.id === event.id)).toBe(false);
  });
});