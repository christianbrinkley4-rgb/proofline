import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { ModelQuotaError, modelCreditsToday, reserveModelCredits } from "./quota";

const userId = randomUUID();
const otherId = randomUUID();
const day = new Date("2026-09-26T12:00:00.000Z");

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values([
    { id: userId, name: "Quota Tester", email: "quota-" + userId + "@example.invalid" },
    { id: otherId, name: "Other Quota Tester", email: "quota-" + otherId + "@example.invalid" },
  ]);

});

describe("daily model credits", () => {
  it("reserves credits atomically per account and resets on the next UTC day", async () => {
    expect((await reserveModelCredits(userId, "agent.chat", 2, day, 3)).used).toBe(2);
    expect((await reserveModelCredits(userId, "resume.parse", 1, day, 3)).used).toBe(3);
    await expect(reserveModelCredits(userId, "agent.chat", 1, day, 3)).rejects.toBeInstanceOf(ModelQuotaError);
    expect((await reserveModelCredits(otherId, "agent.chat", 1, day, 3)).used).toBe(1);
    expect((await reserveModelCredits(userId, "agent.chat", 1, new Date("2026-09-27T00:01:00.000Z"), 3)).used).toBe(1);
  });

  it("does not allow concurrent calls to exceed the limit", async () => {
    const freshId = randomUUID();
    await db.insert(schema.user).values({
      id: freshId, name: "Concurrent Tester", email: "quota-" + freshId + "@example.invalid",
    });
    const results = await Promise.allSettled([
      reserveModelCredits(freshId, "bullets.generate", 1, day, 1),
      reserveModelCredits(freshId, "bullets.generate", 1, day, 1),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
  it("enforces one shared limit across accounts and resets it on the next UTC day", async () => {
    const firstDay = new Date("2026-10-03T12:00:00.000Z");
    const results = await Promise.allSettled([
      reserveModelCredits(userId, "beta.shared", 1, firstDay, 10, 1),
      reserveModelCredits(otherId, "beta.shared", 1, firstDay, 10, 1),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: { scope: "platform" } });
    expect((await reserveModelCredits(otherId, "beta.shared", 1, new Date("2026-10-04T00:01:00.000Z"), 10, 1)).used).toBe(1);
  });
});

describe("showing today's credits", () => {
  it("counts what enforcement counts, from the same UTC midnight, without spending any", async () => {
    const id = randomUUID();
    await db.insert(schema.user).values({ id, name: "Counter", email: "quota-" + id + "@example.invalid" });
    const noon = new Date("2026-10-02T12:00:00.000Z");
    expect(await modelCreditsToday(id, noon, 50)).toEqual({ used: 0, limit: 50, left: 50 });
    await reserveModelCredits(id, "review.resume", 8, noon, 50);
    expect(await modelCreditsToday(id, noon, 50)).toEqual({ used: 8, limit: 50, left: 42 });
    expect(await modelCreditsToday(id, noon, 50)).toEqual({ used: 8, limit: 50, left: 42 });
    // The next UTC day starts over, and a lowered limit never shows a negative.
    expect(await modelCreditsToday(id, new Date("2026-10-03T00:00:01.000Z"), 50)).toEqual({ used: 0, limit: 50, left: 50 });
    expect(await modelCreditsToday(id, noon, 5)).toEqual({ used: 8, limit: 5, left: 0 });
  });
});
