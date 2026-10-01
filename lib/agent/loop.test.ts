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
import { readyBarReason, recheckRun, reviewFailureReason, runLoop, type LoopDeps } from "./loop";

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
  letter: async () => ({ ok: true }),
  ...over,
});

describe("the assisted loop", () => {
  beforeAll(async () => {
    await dbReady;
    await refreshFeed({ boards: [{ source: "greenhouse", slug: "loopco", company: "LoopCo" }], now: NOW, fetch: async () => [1, 2, 3, 4, 5].map((n) => posting(n)) });
  }, 60_000);

  // The October 1 production crash: a brand-new account pressed "Find 3 ready to apply" and the run stopped
  // before it touched a role. The test database now rejects the query the hosted one rejected (lib/db/strict-params.ts).
  it("starts for a brand-new account: one school, one confirmed role, no earlier runs", async () => {
    const userId = "loop-user-fresh";
    await makeUser(userId);
    expect(await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) })).toHaveLength(0);
    const summary = await runLoop(userId, "fresh@example.com", { deps: deps() });
    expect(summary).toEqual({ blocked: null, looked: 3, ready: 3, needsYou: 0, skipped: 0, unconfirmed: 0 });
  });

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
      expect((run.steps as Array<{ step: string; ok: boolean }>).map((s) => s.step)).toEqual(["found", "live", "fit", "track", "resume", "review", "letter"]);
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

  it("stops at the cover letter when it needs the person's own reason, and keeps the passing resume on the tracker", async () => {
    const userId = "loop-user-letter";
    await makeUser(userId);
    const reason = "Add one or two sentences on why you want this job. That part has to be in your own words.";
    const summary = await runLoop(userId, "loop@example.com", { limit: 1, deps: deps({ letter: async () => ({ ok: false, reason, needs: "why" }) }) });
    expect(summary).toMatchObject({ ready: 0, needsYou: 1 });
    const [run] = await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) });
    expect(run).toMatchObject({ status: "needs_you", reason });
    const steps = run.steps as Array<{ step: string; ok: boolean; needs?: string }>;
    expect(steps.at(-1)).toMatchObject({ step: "letter", ok: false, needs: "why" });
    expect(steps.filter((s) => s.step === "review")).toHaveLength(1);
    const app = await db.query.application.findFirst({ where: eq(schema.application.id, run.applicationId!) });
    expect(app?.resumeId).toBe(run.resumeId);
  });

  it("does not call the letter step for a role whose resume failed review", async () => {
    const userId = "loop-user-resume-first";
    await makeUser(userId);
    const letter = vi.fn(async () => ({ ok: true as const }));
    await runLoop(userId, "loop@example.com", { limit: 1, deps: deps({ review: async () => failingGate(), letter }) });
    expect(letter).not.toHaveBeenCalled();
  });

  it("records an error in one role without losing the others", async () => {
    const userId = "loop-user-error";
    await makeUser(userId);
    let calls = 0;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const summary = await runLoop(userId, "loop@example.com", {
      deps: deps({
        tailor: async (id, job) => {
          if (calls++ === 0) throw new Error("Failed query: insert into resume (secret)");
          return deps().tailor!(id, job, "x");
        },
      }),
    });
    expect(summary).toMatchObject({ needsYou: 1, ready: 2 });
    // The person reads a code, never the error; the log has the real error under the same code.
    const [run] = await db.query.agentRun.findMany({ where: and(eq(schema.agentRun.userId, userId), eq(schema.agentRun.status, "needs_you")) });
    const code = run.reason!.match(/code (ERR-[2-9A-HJKMNP-Z]{5})\)/)?.[1];
    expect(code).toBeDefined();
    expect(run.reason).not.toContain("Failed query");
    const line = logged.mock.calls.map((c) => String(c[1])).find((l) => l.includes(code!));
    expect(JSON.parse(line!)).toMatchObject({ code, userId, scope: "role", message: "Failed query: insert into resume (secret)" });
    logged.mockRestore();
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
  const rejects = (status?: number) => async () => Promise.reject(status ? new SourceError(String(status), status) : new Error("offline"));

  it("reads a 404 as closed, other failures as unconfirmed, and never opens a board it cannot check", async () => {
    for (const source of ["greenhouse", "lever", "smartrecruiters"] as const) {
      expect(await checkPostingOpen(source, "acme:1", async () => ({}) as never), source).toBe("open");
      expect(await checkPostingOpen(source, "acme:1", rejects(404)), source).toBe("closed");
      expect(await checkPostingOpen(source, "acme:1", rejects(500)), source).toBe("unconfirmed");
      expect(await checkPostingOpen(source, "acme:1", rejects()), source).toBe("unconfirmed");
    }
    expect(await checkPostingOpen("workday", "acme:1", async () => ({}) as never)).toBe("unconfirmed");
    expect(await checkPostingOpen("greenhouse", "no-colon", async () => ({}) as never)).toBe("unconfirmed");
  });

  it("asks each board its own endpoint", async () => {
    const asked: string[] = [];
    const record = async (url: string) => {
      asked.push(url);
      return {} as never;
    };
    await checkPostingOpen("greenhouse", "acme:123", record);
    await checkPostingOpen("lever", "acme:9f1c-22", record);
    await checkPostingOpen("smartrecruiters", "LinkedIn3:7440001", record);
    expect(asked).toEqual([
      "https://boards-api.greenhouse.io/v1/boards/acme/jobs/123",
      "https://api.lever.co/v0/postings/acme/9f1c-22",
      "https://api.smartrecruiters.com/v1/companies/LinkedIn3/postings/7440001",
    ]);
  });

  it("reads Ashby's board list, because Ashby has no public single-posting check", async () => {
    const board = async () => ({ jobs: [{ id: "aaa" }, { id: "bbb" }] }) as never;
    expect(await checkPostingOpen("ashby", "ramp:aaa", board)).toBe("open");
    expect(await checkPostingOpen("ashby", "ramp:zzz", board)).toBe("closed");
    // Not being able to read the list, or a reply with no list, says nothing about the posting.
    expect(await checkPostingOpen("ashby", "ramp:aaa", rejects(500))).toBe("unconfirmed");
    expect(await checkPostingOpen("ashby", "ramp:aaa", rejects(404))).toBe("unconfirmed");
    expect(await checkPostingOpen("ashby", "ramp:aaa", async () => ({}) as never)).toBe("unconfirmed");
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


describe("the ready bar", () => {
  const lint = (id: string, label: string, detail: string, passed: boolean, severity = "WARN") => ({ id, label, severity, passed, evidence_quote: passed ? "" : "x", failures: passed ? [] : ["x"], detail }) as unknown as GateResult["linter"][number];

  it("lets a resume through only when the formatting mistakes a person would catch are all absent", () => {
    expect(readyBarReason({ ...passingGate(), linter: [lint("consistent_date_format", "One date format", "Dates all use one style.", true)] })).toBeNull();
    expect(readyBarReason({ ...passingGate(), linter: [lint("bullets_have_numbers", "Every bullet has a number", "2 of 6 bullets have no number.", false)] })).toBeNull();
  });

  it("names the one thing to fix, or says how many", () => {
    const dates = lint("consistent_date_format", "One date format", "Dates mix May 2025 and 05/2025. Pick one.", false);
    expect(readyBarReason({ ...passingGate(), linter: [dates] })).toBe("Dates mix May 2025 and 05/2025. Pick one.");
    const spaces = lint("no_trailing_or_double_spaces", "No stray spaces", "There's a double space or a space at the end of a line.", false);
    expect(readyBarReason({ ...passingGate(), linter: [dates, spaces] })).toBe("Fix 2 things before it counts as ready: one date format; no stray spaces.");
  });

  it("keeps a role that passed the download gate in needs-you when its formatting is not clean", async () => {
    const userId = "loop-user-bar";
    await makeUser(userId);
    const sloppy: GateResult = { ...passingGate(), linter: [lint("consistent_bold", "Titles bold; company and location plain", "Bold only the job title. Keep the company and location plain.", false)] };
    const letter = vi.fn(async () => ({ ok: true as const }));
    const summary = await runLoop(userId, "loop@example.com", { limit: 1, deps: deps({ review: async () => sloppy, letter }) });
    expect(summary).toMatchObject({ ready: 0, needsYou: 1 });
    expect(letter).not.toHaveBeenCalled();
    const [run] = await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) });
    expect(run.reason).toBe("Bold only the job title. Keep the company and location plain.");
  });
});

describe("checking a stopped role again", () => {
  it("runs a role that stopped for a reason the person has since fixed, and makes it ready", async () => {
    const userId = "loop-user-recheck";
    await makeUser(userId);
    await runLoop(userId, "loop@example.com", { limit: 1, deps: deps({ review: async () => failingGate() }) });
    const [stopped] = await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) });
    expect(stopped.status).toBe("needs_you");
    const before = (await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) })).length;

    const result = await recheckRun(userId, "loop@example.com", stopped.id, { deps: deps() });
    expect(result).toEqual({ ok: true, status: "ready", reason: null });
    const run = await db.query.agentRun.findFirst({ where: eq(schema.agentRun.id, stopped.id) });
    expect(run).toMatchObject({ status: "ready", reason: null });
    expect((run!.steps as Array<{ step: string }>).map((s) => s.step)).toEqual(["found", "live", "fit", "track", "resume", "review", "letter"]);
    const app = await db.query.application.findFirst({ where: eq(schema.application.id, run!.applicationId!) });
    expect(app?.resumeId).toBe(run!.resumeId);
    // The same role, run again: no second row.
    expect((await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) })).length).toBe(before);
  });

  it("says why when it is still stopped, and leaves the role waiting", async () => {
    const userId = "loop-user-recheck-again";
    await makeUser(userId);
    await runLoop(userId, "loop@example.com", { limit: 1, deps: deps({ review: async () => failingGate() }) });
    const [stopped] = await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) });
    const result = await recheckRun(userId, "loop@example.com", stopped.id, { deps: deps({ review: async () => failingGate() }) });
    expect(result).toEqual({ ok: true, status: "needs_you", reason: "The final read-through flagged a line to fix." });
    expect((await db.query.agentRun.findFirst({ where: eq(schema.agentRun.id, stopped.id) }))?.status).toBe("needs_you");
  });

  it("closes the role for good when the employer has taken the posting down since", async () => {
    const userId = "loop-user-recheck-closed";
    await makeUser(userId);
    await runLoop(userId, "loop@example.com", { limit: 1, deps: deps({ review: async () => failingGate() }) });
    const [stopped] = await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) });
    const result = await recheckRun(userId, "loop@example.com", stopped.id, { deps: deps({ checkLive: async () => "closed" }) });
    expect(result).toEqual({ ok: true, status: "skipped", reason: "The employer took this posting down." });
    await db.update(schema.job).set({ closedAt: null, listedAt: new Date() }).where(eq(schema.job.id, stopped.jobId));
  });

  it("keeps the tracker entry when the check ends early", async () => {
    const userId = "loop-user-recheck-link";
    await makeUser(userId);
    await runLoop(userId, "loop@example.com", { limit: 1, deps: deps({ review: async () => failingGate() }) });
    const [stopped] = await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) });
    expect(stopped.applicationId).not.toBeNull();
    await recheckRun(userId, "loop@example.com", stopped.id, { deps: deps({ checkLive: async () => "unconfirmed" }) });
    const after = await db.query.agentRun.findFirst({ where: eq(schema.agentRun.id, stopped.id) });
    expect(after).toMatchObject({ status: "unconfirmed", applicationId: stopped.applicationId });
  });

  it("only takes the person's own role that is still waiting", async () => {
    const userId = "loop-user-recheck-guard";
    await makeUser(userId);
    await runLoop(userId, "loop@example.com", { limit: 1, deps: deps() });
    const [ready] = await db.query.agentRun.findMany({ where: eq(schema.agentRun.userId, userId) });
    expect(await recheckRun(userId, "loop@example.com", ready.id, { deps: deps() })).toMatchObject({ ok: false });
    await db.update(schema.agentRun).set({ status: "needs_you" }).where(eq(schema.agentRun.id, ready.id));
    expect(await recheckRun("someone-else", "x@example.com", ready.id, { deps: deps() })).toMatchObject({ ok: false });
    await db.update(schema.agentRun).set({ dismissedAt: new Date() }).where(eq(schema.agentRun.id, ready.id));
    expect(await recheckRun(userId, "loop@example.com", ready.id, { deps: deps() })).toMatchObject({ ok: false });
  });
});
