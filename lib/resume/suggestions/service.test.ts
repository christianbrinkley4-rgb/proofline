import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { createExperience } from "@/lib/kb/experiences";
import { addFact, listFacts } from "@/lib/kb/facts";
import { listBullets } from "@/lib/resume/bullets/service";
import { verifyBullet } from "@/lib/resume/verify";
import { answerSuggestion, nextSuggestions } from "./service";

const userId = "test-bullet-bank";
let experienceId: string;

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values({ id: userId, name: "Student", email: "bank@example.com" }).onConflictDoNothing();
  experienceId = (await createExperience(userId, { kind: "work", org: "Oakwood Dental", title: "Bookkeeping assistant" })).id;
}, 60_000);

describe("bullet bank answers", () => {
  it("turns a filled, accepted question into a confirmed fact and active verified bullet", async () => {
    const [item] = await db.insert(schema.bulletSuggestion).values({
      userId, experienceId, text: "Reconciled [how many?] vendor accounts each month", taskId: "books.reconcile", kind: "likely_task",
      skills: ["Account reconciliation"], sourceFactIds: [], slot: "how many?", batch: 1, generator: "offline",
    }).returning();
    await expect(answerSuggestion(userId, item.id, { answer: "yes" })).rejects.toThrow(/number/);
    const result = await answerSuggestion(userId, item.id, { answer: "yes", slotValue: "27" });
    expect(result.status).toBe("accepted");
    const fact = (await listFacts(userId, { experienceId, states: ["confirmed"] })).find((row) => row.sourceDetail === `suggestion:${item.id}`);
    const bullet = (await listBullets(userId, [experienceId])).find((row) => row.id === result.bulletId);
    expect(fact).toMatchObject({ content: "Reconciled 27 vendor accounts each month", source: "user_stated" });
    expect(bullet).toMatchObject({ status: "active", factIds: [fact!.id] });
    expect(verifyBullet(bullet!.text, [fact!.content]).ok).toBe(true);
    expect(await answerSuggestion(userId, item.id, { answer: "yes", slotValue: "27" })).toMatchObject({ status: "already_answered", bulletId: null });
    expect((await listFacts(userId, { experienceId, states: ["confirmed"] })).filter((row) => row.sourceDetail === `suggestion:${item.id}`)).toHaveLength(1);
  });

  it("reuses the confirmed source fact when accepting an unchanged reframe", async () => {
    const source = await addFact(userId, {
      category: "experience", content: "I checked intake forms for missing information and routed questions to nurses.",
      source: "user_stated", experienceId,
    });
    const [item] = await db.insert(schema.bulletSuggestion).values({
      userId, experienceId, text: "Checked intake forms for missing information and routed questions to nurses",
      taskId: null, kind: "reframe", skills: [], sourceFactIds: [source.id], batch: 3, generator: "offline",
    }).returning();
    const factsBefore = (await listFacts(userId, { experienceId, states: ["confirmed"] })).length;
    const result = await answerSuggestion(userId, item.id, { answer: "yes" });
    const factsAfter = (await listFacts(userId, { experienceId, states: ["confirmed"] })).length;
    const bullet = (await listBullets(userId, [experienceId])).find((row) => row.id === result.bulletId);
    expect(factsAfter).toBe(factsBefore);
    expect(bullet).toMatchObject({ status: "active", factIds: [source.id] });
  });
  it("records a no without creating a fact or bullet, and hides its related task", async () => {
    const [item] = await db.insert(schema.bulletSuggestion).values({
      userId, experienceId, text: "Processed vendor invoices and tracked payments", taskId: "books.payables", kind: "likely_task",
      skills: ["Accounts payable"], sourceFactIds: [], batch: 2, generator: "offline",
    }).returning();
    const factsBefore = (await listFacts(userId, { experienceId, states: ["confirmed"] })).length;
    const bulletsBefore = (await listBullets(userId, [experienceId])).length;
    await answerSuggestion(userId, item.id, { answer: "no", reason: "not_true" });
    expect(await answerSuggestion(userId, item.id, { answer: "yes" })).toMatchObject({ status: "already_answered", bulletId: null });
    expect((await listFacts(userId, { experienceId, states: ["confirmed"] })).length).toBe(factsBefore);
    expect((await listBullets(userId, [experienceId])).length).toBe(bulletsBefore);
    const next = await nextSuggestions(userId, experienceId, 10);
    expect(next.some((row) => row.taskId === "books.payables" || row.taskId === "books.reconcile")).toBe(false);
  });
});
