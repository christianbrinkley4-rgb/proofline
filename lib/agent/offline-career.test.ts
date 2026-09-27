import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { setCareerGoal } from "@/lib/career/service";
import { offlineReply } from "./offline";

const userId = randomUUID();
const ctx = { userId, email: `career-${userId}@example.invalid`, client: "Proofline" };

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values({ id: userId, name: "Exploring Person", email: ctx.email });
}, 60_000);

describe("offline career discovery", () => {
  it("asks one grounded question when the person has no direction", async () => {
    const reply = await offlineReply("I feel lost and don't know what to do with my life", ctx);
    expect(reply.text).toContain("don't need to know your job title");
    expect(reply.text).toContain("/app/career");
    expect(reply.tools).toEqual([]);
  });

  it("uses the saved goal and offers a small experiment", async () => {
    await setCareerGoal(userId, {
      targetRole: "Explore career directions",
      targetMonth: null,
      motivation: "I enjoy explaining ideas but am unsure about jobs.",
      benchmarkJobId: null,
    });
    const reply = await offlineReply("How do I figure out my career path?", ctx);
    expect(reply.text).toContain("Explore career directions");
    expect(reply.text).toContain("Notice when you feel engaged");
    expect(reply.text).toContain("career check-in");
  });
});