import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import {
  addFact,
  addFacts,
  confirmFact,
  confirmFacts,
  getFact,
  rejectFact,
} from "./facts";

const userId = "test-user-facts-bulk";

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values({ id: userId, name: "Facts Bulk", email: "facts-bulk@example.com" }).onConflictDoNothing();
}, 60_000);

describe("confirmFacts", () => {
  it("confirms many facts in one shot and skips rejected rows", async () => {
    const [a, b, rejected] = await Promise.all([
      addFact(userId, { category: "skill", content: `Excel-${crypto.randomUUID()}`, source: "resume_parsed" }),
      addFact(userId, { category: "skill", content: `Sheets-${crypto.randomUUID()}`, source: "resume_parsed" }),
      addFact(userId, { category: "skill", content: `Nope-${crypto.randomUUID()}`, source: "resume_parsed" }),
    ]);
    await rejectFact(userId, rejected.id);

    const rows = await confirmFacts(userId, [a.id, b.id, rejected.id, a.id]);
    expect(rows.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
    expect(rows.every((r) => r.verificationState === "confirmed")).toBe(true);

    const stillRejected = await getFact(userId, rejected.id);
    expect(stillRejected?.verificationState).toBe("rejected");

    const events = await db.query.agentEvent.findMany({
      where: eq(schema.agentEvent.userId, userId),
    });
    const confirmed = events.filter(
      (e) => e.type === "fact_confirmed" && [a.id, b.id].includes((e.data as { factId?: string }).factId ?? ""),
    );
    expect(confirmed).toHaveLength(2);
  });

  it("returns nothing for an empty id list", async () => {
    expect(await confirmFacts(userId, [])).toEqual([]);
  });
});

describe("confirm/reject state guards", () => {
  it("does not re-confirm or re-reject a rejected fact", async () => {
    const fact = await addFact(userId, {
      category: "other",
      content: `Rejected-${crypto.randomUUID()}`,
      source: "resume_parsed",
    });
    await rejectFact(userId, fact.id);

    expect(await confirmFact(userId, fact.id)).toBeUndefined();
    expect(await rejectFact(userId, fact.id)).toBeUndefined();

    const row = await getFact(userId, fact.id);
    expect(row?.verificationState).toBe("rejected");
  });
});

describe("addFacts", () => {
  it("inserts independent facts together with batched events", async () => {
    const contents = [`Batch-A-${crypto.randomUUID()}`, `Batch-B-${crypto.randomUUID()}`];
    const rows = await addFacts(userId, [
      { category: "skill", content: contents[0], source: "resume_parsed", sourceDetail: "cv.pdf" },
      { category: "tool", content: contents[1], source: "user_stated", sourceDetail: "profile" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.verificationState)).toEqual(["unconfirmed", "confirmed"]);

    const events = await db.query.agentEvent.findMany({ where: eq(schema.agentEvent.userId, userId) });
    const forRows = events.filter((e) => rows.some((r) => (e.data as { factId?: string }).factId === r.id));
    expect(forRows.map((e) => e.type).sort()).toEqual(["fact_confirmed", "fact_proposed"]);
  });
});
