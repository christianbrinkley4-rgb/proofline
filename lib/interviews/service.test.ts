import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/lib/db";

const mongo = vi.hoisted(() => {
  const documents: Record<string, Array<Record<string, unknown>>> = {};
  const matches = (doc: Record<string, unknown>, filter: Record<string, unknown>) => Object.entries(filter).every(([k, v]) => doc[k] === v);
  let unavailable = false;
  return { documents, fail: (value: boolean) => { unavailable = value; }, collection: (name: string) => ({
    insertOne: async (doc: Record<string, unknown>) => { if (unavailable) throw new Error("Atlas unavailable"); (documents[name] ??= []).push({ ...doc }); return { acknowledged: true }; },
    find: (filter: Record<string, unknown>) => ({ sort() { return this; }, toArray: async () => (documents[name] ?? []).filter((doc) => matches(doc, filter)).sort((a, b) => String(b.at).localeCompare(String(a.at))) }),
    updateOne: async (filter: Record<string, unknown>, update: { $set: Record<string, unknown>; $setOnInsert: Record<string, unknown> }) => {
      if (unavailable) throw new Error("Atlas unavailable");
      const rows = documents[name] ??= []; const found = rows.find((doc) => matches(doc, filter));
      if (found) Object.assign(found, update.$set); else rows.push({ ...update.$setOnInsert, ...update.$set });
    },
    deleteMany: async (filter: Record<string, unknown>) => { documents[name] = (documents[name] ?? []).filter((doc) => !matches(doc, filter)); },
  }) };
});
vi.mock("./mongo", () => ({ atlasConfigured: () => true, atlas: async () => mongo }));
import { calibrationForUser, deleteInterviewData, loadInterviewData, recordGatePrediction, saveOutcome } from "./service";

const userId = randomUUID(); const otherId = randomUUID(); let jobId: string; let appId: string;
beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values([{ id: userId, name: "Prediction tester", email: `${userId}@example.invalid` }, { id: otherId, name: "Other tester", email: `${otherId}@example.invalid` }]);
  const [job] = await db.insert(schema.job).values({ source: "link", sourceId: randomUUID(), companySlug: "example", dedupeKey: randomUUID(), title: "Analyst", company: "Example", url: "https://example.com/jobs/1", description: "Excel reporting", keywords: ["Excel"] }).returning();
  jobId = job.id;
}, 60_000);

describe("prediction and outcome persistence", () => {
  it("stores a numeric prediction on the automatically tracked application", async () => {
    const p = await recordGatePrediction(userId, jobId, "resume", "exact-document"); appId = p.applicationId;
    expect(p.probability).toBeGreaterThanOrEqual(0); expect(p.probability).toBeLessThanOrEqual(100); expect(p.reasoning).toMatch(/^For: .+; against: .+\.$/);
    expect(mongo.documents.interview_predictions[0]).toMatchObject({ userId, applicationId: appId, fingerprint: "exact-document", probability: p.probability });
    expect((await loadInterviewData(otherId)).predictions).toEqual([]);
    await expect(saveOutcome(otherId, appId, "interview")).rejects.toThrow("Submit");
    await expect(saveOutcome(userId, appId, "interview")).rejects.toThrow("Submit");
  });
  it("marks an outcome once, updates calibration, and keeps post-submission predictions out", async () => {
    await db.update(schema.application).set({ appliedAt: new Date(), stage: "applied" }).where(eq(schema.application.id, appId));
    const first = await saveOutcome(userId, appId, "interview");
    const later = await recordGatePrediction(userId, jobId, "follow_up", "later-document");
    expect(later.id).not.toBe(first.predictionId);
    const data = await calibrationForUser(userId);
    expect(data.buckets.reduce((sum, b) => sum + b.count, 0)).toBe(1);
    expect(data.buckets.find((b) => b.count === 1)?.actual).toBe(100);
    await saveOutcome(userId, appId, "rejection");
    expect(mongo.documents.application_outcomes).toHaveLength(1);
    expect((await calibrationForUser(userId)).buckets.find((b) => b.count)?.actual).toBe(0);
    expect((await loadInterviewData(userId)).outcomes[0].predictionId).toBe(first.predictionId);
  });
  it("does not claim persistence when Atlas rejects the write", async () => {
    mongo.fail(true);
    await expect(recordGatePrediction(userId, jobId, "resume", "not-saved")).rejects.toThrow("Atlas unavailable");
    await expect(saveOutcome(userId, appId, "no_response")).rejects.toThrow("Atlas unavailable");
    mongo.fail(false);
    expect((await loadInterviewData(userId)).outcomes[0].outcome).toBe("rejection");
  });
  it("removes only the owner's prediction and outcome history", async () => {
    await deleteInterviewData(otherId, appId); expect((await loadInterviewData(userId)).predictions.length).toBeGreaterThan(0);
    await deleteInterviewData(userId, appId); expect((await loadInterviewData(userId)).predictions).toEqual([]); expect((await loadInterviewData(userId)).outcomes).toEqual([]);
  });
});
