import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { upsertJobs } from "@/lib/jobs/store";
import { addFact } from "@/lib/kb/facts";
import { careerDashboard, recordCareerCheckin, setCareerGoal } from "./service";

const userId = randomUUID();
const otherId = randomUUID();

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values([
    { id: userId, name: "Goal Setter", email: `career-${userId}@example.invalid` },
    { id: otherId, name: "Other Student", email: `career-${otherId}@example.invalid` },
  ]);
}, 60_000);

describe("career goal tracking", () => {
  it("keeps a baseline and adds a new check-in only when confirmed evidence changes", async () => {
    const goal = await setCareerGoal(userId, {
      targetRole: "Bookkeeper", targetMonth: "2027-06", motivation: "I like careful record keeping", benchmarkJobId: null,
    });
    const initial = await careerDashboard(userId);
    expect(initial.goal?.id).toBe(goal.id);
    expect(initial.checkins).toHaveLength(1);
    expect(initial.current?.confirmedFacts).toBe(0);
    expect(initial.actions.map((action) => action.id)).toContain("first-evidence");

    expect((await recordCareerCheckin(userId, goal.id)).created).toBe(false);
    expect((await careerDashboard(userId)).checkins).toHaveLength(1);

    await addFact(userId, { category: "skill", content: "QuickBooks", source: "user_stated" });
    expect((await recordCareerCheckin(userId, goal.id)).created).toBe(true);
    const progress = await careerDashboard(userId);
    expect(progress.current?.confirmedFacts).toBe(1);
    expect(progress.checkins).toHaveLength(2);
    expect(progress.checkins[0].confirmedFacts).toBe(1);
    expect(progress.checkins[1].confirmedFacts).toBe(0);
    await recordCareerCheckin(userId, goal.id, "A conversation helped me compare bookkeeping with other work.");
    expect((await careerDashboard(userId)).checkins[0].reflection).toContain("conversation");
  });

  it("uses only the user's saved benchmark posting", async () => {
    const [job] = (await upsertJobs([{
      source: "link", sourceId: `career-${userId}`, company: "Example Ledger", title: "Bookkeeper",
      location: null, mode: "unknown", level: "entry", url: `https://example.invalid/${userId}`,
      description: "Responsibilities: Reconcile accounts in QuickBooks each month. Qualifications: QuickBooks required. Excel required.",
      department: null, employmentType: null, payMin: null, payMax: null, payPeriod: null, postedAt: null,
    }])).values();
    await db.insert(schema.jobMatch).values({ userId, jobId: job.id, status: "saved" });
    await expect(setCareerGoal(otherId, { targetRole: "Bookkeeper", targetMonth: null, motivation: null, benchmarkJobId: job.id }))
      .rejects.toThrow("saved postings");
    const goal = await setCareerGoal(userId, { targetRole: "Bookkeeper", targetMonth: null, motivation: null, benchmarkJobId: job.id });
    const dashboard = await careerDashboard(userId);
    expect(dashboard.goal?.id).toBe(goal.id);
    expect(dashboard.benchmark?.id).toBe(job.id);
    expect(dashboard.current?.totalRequired).toBeGreaterThan(0);
    expect(dashboard.actions.some((action) => action.id === "benchmark")).toBe(false);

    await db.update(schema.jobMatch).set({ status: "dismissed" }).where(and(
      eq(schema.jobMatch.userId, userId), eq(schema.jobMatch.jobId, job.id),
    ));
    const afterDismissal = await careerDashboard(userId);
    expect(afterDismissal.benchmark?.id).toBe(job.id);
    expect(afterDismissal.options.some((option) => option.id === job.id)).toBe(false);
    await recordCareerCheckin(userId, goal.id);
  });
  it("records completed exploration steps and does not repeat them", async () => {
    const goal = await setCareerGoal(userId, {
      targetRole: "Explore career directions", targetMonth: null,
      motivation: "I want to see which work fits", benchmarkJobId: null,
    });
    expect((await careerDashboard(userId)).actions[0].id).toBe("notice-patterns");
    const checkin = await recordCareerCheckin(userId, goal.id, "Helping at the library felt useful.", "notice-patterns");
    expect(checkin.completedActionId).toBe("notice-patterns");
    const dashboard = await careerDashboard(userId);
    expect(dashboard.actions[0].id).toBe("compare-directions");
    await db.insert(schema.careerCheckin).values(Array.from({ length: 25 }, (_, index) => ({
      userId, goalId: goal.id,
      confirmedFacts: checkin.confirmedFacts, activeBullets: checkin.activeBullets,
      relevantBullets: checkin.relevantBullets, matchedRequired: checkin.matchedRequired,
      totalRequired: checkin.totalRequired, reflection: "Later reflection",
      createdAt: new Date(checkin.createdAt.getTime() + (index + 1) * 1000),
    })));
    expect((await careerDashboard(userId)).actions[0].id).toBe("compare-directions");
    await expect(recordCareerCheckin(userId, goal.id, null, "notice-patterns"))
      .rejects.toThrow("current exploration plan");
    await expect(recordCareerCheckin(userId, goal.id, null, "invented-step"))
      .rejects.toThrow("current exploration plan");
  });
});
