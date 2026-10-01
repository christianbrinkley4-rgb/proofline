import { beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/lib/db";
import { saveEducation, saveRole } from "@/lib/facts/base";
import { updateProfile } from "@/lib/kb/profile";
import type { GateResult } from "@/lib/review/gate";
import { refreshFeed } from "@/lib/jobs/feed/refresh";
import { checkPostingOpen } from "@/lib/jobs/feed/verify-live";
import { SourceError } from "@/lib/jobs/sources/http";
import type { NormalizedJob } from "@/lib/jobs/types";
import { reviewFailureReason, runLoop, type LoopDeps } from "./loop";

const NOW = new Date();
const LONG = (body: string) => `${body}\n\n${"You will join a small team, learn the close process, and work with people across the company every week. ".repeat(5)}`;

const posting = (n: number, over: Partial<NormalizedJob> = {}): NormalizedJob => ({
  source: "greenhouse",
  sourceId: `loopco:${n}`,
  company: "LoopCo",
  title: `Staff Accountant ${n}`,
  location: "Raleigh, NC",
  mode: "onsite",
  level: "entry",
  url: `https://example.com/loopco/${n}`,
  description: LONG("Requirements:\n- Excel\n- Reconciliations\nBachelor's degree in Accounting."),
  department: "Finance",
  employmentType: null,
  payMin: null,
  payMax: null,
  payPeriod: null,
  postedAt: new Date(NOW.getTime() - 5 * 864e5),
  ...over,
});

const passingGate = (): GateResult => ({ version: 1, fingerprint: "x", linter: [], model: { status: "pass", issues: [], model: "test", message: "" }, passed: true, at: new Date().toISOString() });
const failingGate = (): GateResult => ({
  ...passingGate(),
  model: { status: "fail", issues: [{ quote: "q", rule_broken: "r", fix: "f" }], model: "test", message: "" },
  passed: false,
});

async function makeUser(id: string) {
  await db.insert(schema.user).values({ id, name: "Loop", email: `${id}@example.com` }).onConflictDoNothing();
  await updateProfile(id, { gradDate: "2026-12", workAuthorization: "permanent_resident", targetLocations: ["Raleigh, NC"], targetRoles: ["accounting"] });
  await saveEducation(id, [{ school: "UNC Greensboro", degree: "BS", major: "Accounting", gradDate: "2026-12" }]);
  await saveRole(id, { kind: "work", org: "Tax Office", title: "Intern", startDate: "2025-06", endDate: "2025-08", bullets: ["Reconciled 40 vendor accounts each month in Excel"] });
}

const deps = (over: Partial<LoopDeps> = {}): Partial<LoopDeps> => ({
  checkLive: async () => "open",
  tailor: async (userId, job) => {
    const [row] = await db
      .insert(schema.resume)
      .values({ userId, jobId: job.id, name: `${job.title}`, template: "t", variant: "experience", content: {} })
      .returning({ id: schema.resume.id });
    return { ok: true, resumeId: row.id, variant: "experience" };
  },
  review: async () => passingGate(),
  ...over,
});

describe("the assisted loop", () => {
  beforeAll(async () => {
    await dbReady;
    await refreshFeed({ boards: [{ source: "greenhouse", slug: "loopco", company: "LoopCo" }], now: NOW, fetch: async () => [1, 2, 3, 4, 5].map((n) => posting(n)) });
  }, 60_000);

  it("takes the best roles through live check, tracker, resume, and review, and records each stage", async () => {
    const userId = "loop-user-ready";
    await makeUser(userId);
    const live = vi.fn(async () => "open" as const);
    const summary = await runLoop(userId, "loop@example.com", { deps: deps({ checkLive: live }) });
    expect(summary).toMatchObject({ blocked: null, ready: 3, needsYou: 0 });
    expect(live).toHaveBeenCalledTimes(3);

    const runs = await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) });
    expect(runs).toHaveLength(3);
    for (const run of runs) {
      expect(run.status).toBe("ready");
      expect((run.steps as Array<{ step: string; ok: boolean }>).map((s) => s.step)).toEqual(["found", "live", "fit", "track", "resume", "review"]);
      expect(run.resumeId).not.toBeNull();
      const app = await db.query.application.findFirst({ where: eq(schema.application.id, run.applicationId!) });
      expect(app).toMatchObject({ stage: "saved", resumeId: run.resumeId });
    }
  });

  it("does not take the same roles twice, and stops at the three-role cap", async () => {
    const userId = "loop-user-ready";
    const again = await runLoop(userId, "loop@example.com", { deps: deps() });
    expect(again.ready).toBe(2);
    const total = await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) });
    expect(new Set(total.map((r) => r.jobId)).size).toBe(5);
    const third = await runLoop(userId, "loop@example.com", { deps: deps() });
    expect(third).toMatchObject({ looked: 0, ready: 0 });
  });

  it("skips a posting the employer took down and marks it closed for everyone", async () => {
    const userId = "loop-user-closed";
    await makeUser(userId);
    const summary = await runLoop(userId, "loop@example.com", { limit: 1, deps: deps({ checkLive: async (_s, id) => (id === "loopco:1" || id === "loopco:2" || id === "loopco:3" || id === "loopco:4" ? "closed" : "open") }) });
    expect(summary.skipped).toBe(4);
    expect(summary.ready).toBe(1);
    const closed = await db.query.agentRun.findMany({ where: and(eq(schema.agentRun.userId, userId), eq(schema.agentRun.status, "skipped")) });
    expect(closed[0].reason).toBe("The employer took this posting down.");
    const job = await db.query.job.findFirst({ where: eq(schema.job.id, closed[0].jobId) });
    expect(job?.closedAt).not.toBeNull();
    expect(closed[0].applicationId).toBeNull();
    // Closing is shared state; put the pool back for the tests after this one.
    await db.update(schema.job).set({ closedAt: null, listedAt: new Date() }).where(eq(schema.job.company, "LoopCo"));
  });

  it("tries an unreachable board again on the next run and stops after three in a row", async () => {
    const userId = "loop-user-offline";
    await makeUser(userId);
    const first = await runLoop(userId, "loop@example.com", { deps: deps({ checkLive: async () => "unconfirmed" }) });
    expect(first.unconfirmed).toBe(3);
    expect(first.ready).toBe(0);
    expect(first.blocked).toContain("Couldn't reach");
    const retried = await runLoop(userId, "loop@example.com", { deps: deps() });
    expect(retried.ready).toBe(3);
  });

  it("keeps a role that fails review on the tracker with the reason, and counts it toward the cap", async () => {
    const userId = "loop-user-review";
    await makeUser(userId);
    const summary = await runLoop(userId, "loop@example.com", { limit: 2, deps: deps({ review: async () => failingGate() }) });
    expect(summary).toMatchObject({ ready: 0, needsYou: 2 });
    const runs = await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) });
    expect(runs.every((r) => r.status === "needs_you" && r.reason === "The final read-through flagged a line to fix." && r.applicationId && r.resumeId)).toBe(true);
    const app = await db.query.application.findFirst({ where: eq(schema.application.id, runs[0].applicationId!) });
    expect(app?.resumeId).toBeNull();
  });

  it("records an error in one role without losing the others", async () => {
    const userId = "loop-user-error";
    await makeUser(userId);
    let calls = 0;
    const summary = await runLoop(userId, "loop@example.com", {
      deps: deps({
        tailor: async (id, job) => {
          if (calls++ === 0) throw new Error("The database hiccuped.");
          return deps().tailor!(id, job, "x");
        },
      }),
    });
    expect(summary).toMatchObject({ needsYou: 1, ready: 2 });
  });

  it("honors the person's dealbreakers and standing rules", async () => {
    const userId = "loop-user-rules";
    await makeUser(userId);
    await updateProfile(userId, { dealBreakers: ["company:loopco"] });
    const summary = await runLoop(userId, "loop@example.com", { deps: deps() });
    expect(summary).toMatchObject({ looked: 0, ready: 0 });
  });

  it("will not start until the facts a resume needs are confirmed", async () => {
    const userId = "loop-user-empty";
    await db.insert(schema.user).values({ id: userId, name: "Empty", email: "empty@example.com" }).onConflictDoNothing();
    const summary = await runLoop(userId, "empty@example.com", { deps: deps() });
    expect(summary.blocked).toContain("My experience");
    expect(await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) })).toHaveLength(0);
  });
});

describe("live posting check", () => {
  it("reads a 404 as closed, other failures as unconfirmed, and never opens a board it cannot check", async () => {
    expect(await checkPostingOpen("greenhouse", "acme:1", async () => ({}) as never)).toBe("open");
    expect(await checkPostingOpen("greenhouse", "acme:1", async () => Promise.reject(new SourceError("404", 404)))).toBe("closed");
    expect(await checkPostingOpen("greenhouse", "acme:1", async () => Promise.reject(new SourceError("500", 500)))).toBe("unconfirmed");
    expect(await checkPostingOpen("greenhouse", "acme:1", async () => Promise.reject(new Error("offline")))).toBe("unconfirmed");
    expect(await checkPostingOpen("lever", "acme:1", async () => ({}) as never)).toBe("unconfirmed");
  });
});

describe("review failure reasons", () => {
  it("names what to fix before the model read-through", () => {
    const gate = { ...failingGate(), linter: [{ id: "one_page", label: "Fits on one page", severity: "BLOCKING", passed: false, evidence_quote: "", failures: [], detail: "" }] } as GateResult;
    expect(reviewFailureReason(gate)).toBe("Fix first: fits on one page.");
    const withDetail = { ...gate, linter: [{ ...gate.linter[0], detail: "The content needs 2 pages." }] } as GateResult;
    expect(reviewFailureReason(withDetail)).toBe("The content needs 2 pages.");
    const two = { ...gate, linter: [gate.linter[0], { ...gate.linter[0], label: "No em dashes" }] } as GateResult;
    expect(reviewFailureReason(two)).toBe("Fix 2 things first: fits on one page; no em dashes.");
    expect(reviewFailureReason({ ...failingGate(), model: { status: "unavailable", issues: [], model: null, message: "The reviewer is unavailable right now." } })).toBe("The reviewer is unavailable right now.");
  });
});

