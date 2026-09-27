import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/lib/db";
import { getJobForUser, saveMatches, setMatchStatus, upsertJobs } from "./store";
import type { NormalizedJob } from "./types";
import type { FitReport } from "@/lib/fit/engine";

const baseJob = (n: number): NormalizedJob => ({
  source: "greenhouse",
  sourceId: `batch-test:${n}`,
  company: "Batch Co",
  title: `Role ${n}`,
  location: "Raleigh, NC",
  mode: "hybrid",
  level: "internship",
  url: `https://example.com/jobs/${n}`,
  description: n % 2 === 0 ? `Help with accounting work for role ${n}. Excel required.` : null,
  department: "Finance",
  employmentType: "Intern",
  payMin: 20,
  payMax: 25,
  payPeriod: "hour",
  postedAt: new Date("2026-09-01T00:00:00Z"),
});

const fit = (score: number): FitReport => ({
  score,
  raw: score,
  cappedBy: null,
  points: { requiredSkills: 0, experience: 0, education: 0, preferredSkills: 0, keywords: 0, location: 0 },
  details: {
    requiredSkills: { note: "", matched: [], missing: [] },
    experience: { note: "", matched: [], missing: [] },
    education: { note: "", matched: [], missing: [] },
    preferredSkills: { note: "", matched: [], missing: [] },
    keywords: { note: "", matched: [], missing: [] },
    location: { note: "", matched: [], missing: [] },
  },
  gates: [],
  strengths: [],
  gaps: [],
  nextSteps: [],
});

describe("batch upsertJobs / saveMatches", () => {
  const userId = "test-user-batch-upsert";

  beforeAll(async () => {
    await dbReady;
    await db.insert(schema.user).values({ id: userId, name: "Batch", email: "batch@example.com" }).onConflictDoNothing();
    await db.insert(schema.user).values({ id: "test-user-private-posting", name: "Other", email: "other-private@example.com" }).onConflictDoNothing();
  }, 60_000);

  it("upserts many jobs in one pass and keeps an existing description when the refresh omits it", async () => {
    const first = await upsertJobs([baseJob(1), baseJob(2), baseJob(3)]);
    expect(first.size).toBe(3);
    expect(first.get("greenhouse|batch-test:2")?.description).toContain("accounting");

    const refreshed = await upsertJobs([
      { ...baseJob(2), description: null, title: "Role 2 Updated" },
      baseJob(4),
    ]);
    expect(refreshed.get("greenhouse|batch-test:2")?.title).toBe("Role 2 Updated");
    expect(refreshed.get("greenhouse|batch-test:2")?.description).toContain("accounting");
    expect(refreshed.get("greenhouse|batch-test:4")?.sourceId).toBe("batch-test:4");
  });

  it("keeps a pasted description with the account that added it", async () => {
    const rows = await upsertJobs([{ ...baseJob(99), source: "link", sourceId: "pasted:batch-private-99", description: "Private campus posting for one applicant." }]);
    const privateJob = rows.get("link|pasted:batch-private-99")!;
    await saveMatches(userId, [{ job: privateJob, fit: fit(74) }]);
    expect((await getJobForUser(userId, privateJob.id))?.job.id).toBe(privateJob.id);
    expect(await getJobForUser("test-user-private-posting", privateJob.id)).toBeNull();
    await expect(setMatchStatus("test-user-private-posting", privateJob.id, "saved")).rejects.toThrow("not available");
    expect(await getJobForUser("test-user-private-posting", privateJob.id)).toBeNull();
    const publicJob = (await upsertJobs([baseJob(98)])).get("greenhouse|batch-test:98")!;
    expect((await getJobForUser("test-user-private-posting", publicJob.id))?.job.id).toBe(publicJob.id);
  });

  it("saves match rows in chunks for the same user", async () => {
    const rows = await upsertJobs(Array.from({ length: 5 }, (_, i) => baseJob(100 + i)));
    const scored = [...rows.values()].map((job, i) => ({ job, fit: fit(70 + i) }));
    await saveMatches(userId, scored);
    const matches = await db.query.jobMatch.findMany({
      where: eq(schema.jobMatch.userId, userId),
    });
    const ids = new Set(scored.map((s) => s.job.id));
    expect(matches.filter((m) => ids.has(m.jobId)).length).toBe(5);
  });
});
