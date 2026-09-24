import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { listFacts } from "./facts";
import { answerQuestion, listOpenQuestions } from "./questions";
import { experienceFromWords } from "./story";
import { generateBullets, listBullets } from "@/lib/resume/bullets/service";

const userId = "test-user-voice-story";

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values({ id: userId, name: "Voice Student", email: "voice-story@example.com" }).onConflictDoNothing();
}, 60_000);

describe("spoken experience", () => {
  it("keeps the person's statement as evidence and rewrites with their answer", async () => {
    const { experienceId } = await experienceFromWords(userId, {
      kind: "work",
      org: "Oakwood",
      title: "Bookkeeping Assistant",
      notes: "I built a weekly cash report from bank and QuickBooks data.",
      via: "voice",
    });
    const [statement] = await listFacts(userId, { experienceId });
    expect(statement.content).toBe("I built a weekly cash report from bank and QuickBooks data.");
    expect(statement.verificationState).toBe("confirmed");

    await generateBullets(userId, experienceId);
    const initial = await listBullets(userId, [experienceId]);
    expect(initial.some((b) => b.text.startsWith("Built a weekly cash report"))).toBe(true);

    const impact = (await listOpenQuestions(userId, { experienceId })).find((q) => q.prompt.includes("better because"));
    expect(impact).toBeDefined();
    await answerQuestion(userId, impact!.id, "saved the office manager about 3 hours a week");
    await generateBullets(userId, experienceId);

    const improved = (await listBullets(userId, [experienceId])).find((b) => b.text.startsWith("Saved the office manager about 3 hours a week by building"));
    expect(improved?.status).toBe("active");
    expect(improved?.factIds).toHaveLength(2);
  });

  it("does not attach an unlinked result to the wrong activity", async () => {
    const { experienceId } = await experienceFromWords(userId, {
      kind: "work",
      org: "Campus Office",
      notes: "I stocked supplies. I built a weekly cash report.",
      via: "voice",
    });
    const impact = (await listOpenQuestions(userId, { experienceId })).find((q) => q.prompt.includes("better because"));
    expect(impact).toBeDefined();
    await answerQuestion(userId, impact!.id, "saved about 3 hours a week");
    await generateBullets(userId, experienceId);

    const bullets = await listBullets(userId, [experienceId]);
    expect(bullets.some((b) => b.text === "Saved about 3 hours a week")).toBe(true);
    expect(bullets.every((b) => !b.text.includes("by stocking supplies") && !b.text.includes("by building a weekly cash report"))).toBe(true);
  });
});
