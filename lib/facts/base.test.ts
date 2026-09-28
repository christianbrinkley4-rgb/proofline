import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { createExperience } from "@/lib/kb/experiences";
import { lintResume } from "@/lib/review/linter";
import { addBulletFact, confirmedFactTexts, editFact, saveRole } from "./base";

const userId = randomUUID();
const otherId = randomUUID();

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values([
    { id: userId, name: "Edit Tester", email: `edit-${userId}@example.invalid` },
    { id: otherId, name: "Other Tester", email: `edit-${otherId}@example.invalid` },
  ]);
}, 60_000);

describe("editing a bullet fact from the resume", () => {
  it("replaces the old wording everywhere and keeps one active bullet on the new fact", async () => {
    const experience = await saveRole(userId, { kind: "work", org: "Campus Bookstore", title: "", startDate: "", endDate: "", bullets: [] }, "test");
    const added = await addBulletFact(userId, experience, "Reconciled vendor accounts in QuickBooks", "test");
    expect(added).not.toBeNull();

    const next = await editFact(userId, added!.fact.id, "Reconciled 40 vendor accounts a month in QuickBooks");

    const facts = await confirmedFactTexts(userId);
    expect(facts).toContain("Reconciled 40 vendor accounts a month in QuickBooks");
    expect(facts).not.toContain("Reconciled vendor accounts in QuickBooks");

    const active = await db.query.bullet.findMany({ where: and(eq(schema.bullet.userId, userId), eq(schema.bullet.experienceId, experience.id), eq(schema.bullet.status, "active")) });
    expect(active).toHaveLength(1);
    expect(active[0].text).toBe(next.content);
    expect(active[0].factIds).toEqual([next.id]);
  });

  it("lets the linter accept the edited number and still block one that was never confirmed", async () => {
    const facts = await confirmedFactTexts(userId);
    const base = "**Edit Tester**\nedit@example.invalid | 555-0100\nEXPERIENCE\n**Campus Bookstore**\n";
    const byId = (text: string) => lintResume({ resumeText: base + text, jobDescription: "Accounting intern. QuickBooks.", userFacts: facts }).find((c) => c.id === "no_unconfirmed_claims")!;

    expect(byId("- Reconciled 40 vendor accounts a month in QuickBooks").passed).toBe(true);
    expect(byId("- Reconciled 90 vendor accounts a month in QuickBooks").passed).toBe(false);
  });

  it("won't edit another person's fact", async () => {
    const experience = await createExperience(userId, { kind: "work", org: "Library" });
    const added = await addBulletFact(userId, experience, "Shelved returns for the circulation desk", "test");
    await expect(editFact(otherId, added!.fact.id, "Shelved 300 returns a week")).rejects.toThrow("isn't on your list");
  });
});
