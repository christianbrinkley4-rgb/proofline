import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { createExperience } from "@/lib/kb/experiences";
import { addFact, reviseFact } from "@/lib/kb/facts";
import { ensureProfile } from "@/lib/kb/profile";
import { createStoryNote } from "@/lib/kb/story";
import { createToken } from "@/lib/agent/tokens";
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
}, 60_000);

describe("account data", () => {
  it("exports every version of every fact, without token secrets", async () => {
    const data = await exportAccount(userId);
    expect(data.user?.email).toBe("delete-me@example.com");
    expect(data.facts.map((f) => f.content).sort()).toEqual(["Trained 4 new hires", "Trained 5 new hires"]);
    expect(data.storyNotes).toHaveLength(1);
    expect(data.connections[0]).not.toHaveProperty("tokenHash");
  });

  it("deletes the account and everything tied to it", async () => {
    await deleteAccount(userId);
    const [user, facts, notes, tokens, profile] = await Promise.all([
      db.query.user.findFirst({ where: eq(schema.user.id, userId) }),
      db.query.fact.findMany({ where: eq(schema.fact.userId, userId) }),
      db.query.storyNote.findMany({ where: eq(schema.storyNote.userId, userId) }),
      db.query.apiToken.findMany({ where: eq(schema.apiToken.userId, userId) }),
      db.query.profile.findFirst({ where: eq(schema.profile.userId, userId) }),
    ]);
    expect(user).toBeUndefined();
    expect(facts).toEqual([]);
    expect(notes).toEqual([]);
    expect(tokens).toEqual([]);
    expect(profile).toBeUndefined();
  });
});
