import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/lib/db";
import { saveEducation, saveRole } from "@/lib/facts/base";
import { updateProfile } from "@/lib/kb/profile";
import { lastRunFailure } from "./failure";
import type { LoopSummary } from "./loop";
import { digestEmail, MIN_HOURS_BETWEEN_RUNS, runScheduled, type ScheduleDeps } from "./schedule";

const summary = (over: Partial<LoopSummary> = {}): LoopSummary => ({ blocked: null, looked: 3, ready: 0, needsYou: 0, skipped: 0, unconfirmed: 0, ...over });
const NOW = new Date("2026-10-02T11:00:00Z");

async function person(id: string, over: { autoRun?: boolean; lastAutoRunAt?: Date | null } = {}) {
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com` }).onConflictDoNothing();
  await updateProfile(id, { autoRun: over.autoRun ?? true, lastAutoRunAt: over.lastAutoRunAt ?? null });
}

const deps = (over: Partial<ScheduleDeps> = {}): Partial<ScheduleDeps> => ({ run: async () => summary(), send: vi.fn(async () => "sent" as const), mailConfigured: () => true, now: () => NOW, ...over });

describe("the morning run", () => {
  beforeAll(async () => {
    await dbReady;
  }, 60_000);

  it("runs only for people who turned it on, the one who has waited longest first", async () => {
    await db.update(schema.profile).set({ autoRun: false });
    await person("sched-old", { lastAutoRunAt: new Date(NOW.getTime() - 3 * 864e5) });
    await person("sched-never", { lastAutoRunAt: null });
    await person("sched-newer", { lastAutoRunAt: new Date(NOW.getTime() - 2 * 864e5) });
    await person("sched-off", { autoRun: false });
    const order: string[] = [];
    const stats = await runScheduled({ deps: deps({ run: async (id) => (order.push(id), summary()) }) });
    expect(order).toEqual(["sched-never", "sched-old", "sched-newer"]);
    expect(stats).toMatchObject({ opted: 3, ran: 3, skipped: 0, failed: 0 });
    const marked = await db.query.profile.findFirst({ where: eq(schema.profile.userId, "sched-never") });
    expect(marked?.lastAutoRunAt).toEqual(NOW);
  });

  it("does not run someone twice in a day, even if the cron fires again", async () => {
    const run = vi.fn(async () => summary());
    const stats = await runScheduled({ deps: deps({ run }) });
    expect(run).not.toHaveBeenCalled();
    expect(stats).toMatchObject({ opted: 3, ran: 0, skipped: 3 });
    // Past the gap, they run again.
    const later = new Date(NOW.getTime() + (MIN_HOURS_BETWEEN_RUNS + 1) * 36e5);
    const again = await runScheduled({ deps: deps({ run, now: () => later }) });
    expect(again.ran).toBe(3);
  });

  it("carries on after one person's run fails", async () => {
    await db.update(schema.profile).set({ autoRun: false });
    await person("sched-a", { lastAutoRunAt: null });
    await person("sched-b", { lastAutoRunAt: new Date(NOW.getTime() - 864e5) });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const stats = await runScheduled({ deps: deps({ run: async (id) => { if (id === "sched-a") throw new Error("boom"); return summary({ ready: 1 }); } }) });
    expect(stats).toMatchObject({ ran: 1, failed: 1, ready: 1 });
    // The failure is logged with a code and the person's id, and kept for their Ready page.
    const failure = await lastRunFailure("sched-a");
    expect(failure).toMatchObject({ scope: "morning", at: NOW.toISOString() });
    expect(JSON.parse(String(logged.mock.calls[0][1]))).toMatchObject({ code: failure!.code, userId: "sched-a", scope: "morning", message: "boom" });
    expect(await lastRunFailure("sched-b")).toBeNull();
    logged.mockRestore();
  });

  // The cron route calls runScheduled with no stand-in, so this is the code path of the morning run.
  it("runs the same loop as the Run button, so the loop's own startup is exercised and does not fail", async () => {
    await db.update(schema.profile).set({ autoRun: false });
    await person("sched-real", { lastAutoRunAt: null });
    await updateProfile("sched-real", { gradDate: "2026-12", workAuthorization: "permanent_resident", targetLocations: ["Raleigh, NC"], targetRoles: ["accounting"] });
    await saveEducation("sched-real", [{ school: "UNC Greensboro", degree: "BS", major: "Accounting", gradDate: "2026-12" }]);
    await saveRole("sched-real", { kind: "work", org: "Tax Office", title: "Intern", startDate: "2025-06", endDate: "2025-08", bullets: ["Reconciled 40 vendor accounts each month in Excel"] });
    // The feed is empty in this file, so the real loop finds nothing to check and needs no network or model.
    const stats = await runScheduled({ deps: { send: vi.fn(async () => "sent" as const), mailConfigured: () => true, now: () => NOW } });
    expect(stats).toMatchObject({ opted: 1, ran: 1, failed: 0 });
    expect(await lastRunFailure("sched-real")).toBeNull();
    const events = await db.query.agentEvent.findMany({ where: eq(schema.agentEvent.userId, "sched-real") });
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["loop_started", "loop_finished", "loop_scheduled"]));
  });

  it("stops starting new people when the time is up, and leaves them for the next call", async () => {
    await db.update(schema.profile).set({ autoRun: false });
    await person("sched-c", { lastAutoRunAt: null });
    await person("sched-d", { lastAutoRunAt: new Date(NOW.getTime() - 864e5) });
    let clock = NOW.getTime();
    const stats = await runScheduled({ deadline: new Date(NOW.getTime() + 1000), deps: deps({ now: () => new Date(clock), run: async () => ((clock += 5000), summary()) }) });
    expect(stats).toMatchObject({ ran: 1, stoppedEarly: true });
    const left = await db.query.profile.findFirst({ where: eq(schema.profile.userId, "sched-d") });
    expect(left?.lastAutoRunAt?.getTime()).toBe(NOW.getTime() - 864e5);
  });

  it("emails only when there is something to say and mail is set up, to the person's own address", async () => {
    await db.update(schema.profile).set({ autoRun: false });
    await person("sched-mail", { lastAutoRunAt: null });
    const send = vi.fn(async () => "sent" as const);
    // Nothing found: no email.
    await runScheduled({ deps: deps({ send, run: async () => summary({ skipped: 3 }) }) });
    expect(send).not.toHaveBeenCalled();
    // Something found, but mail is not set up: no email, no error.
    await db.update(schema.profile).set({ lastAutoRunAt: null }).where(eq(schema.profile.userId, "sched-mail"));
    const quiet = await runScheduled({ deps: deps({ send, mailConfigured: () => false, run: async () => summary({ ready: 1 }) }) });
    expect(send).not.toHaveBeenCalled();
    expect(quiet).toMatchObject({ ran: 1, emailed: 0 });
  });

  it("describes what the run left on the Ready page, and nothing else", () => {
    const note = digestEmail({
      ready: [{ title: "Tax Operations Intern", company: "Coinbase", reason: null }],
      needsYou: [{ title: "Accounting Intern", company: "Akuna Capital", reason: "Add one or two sentences on why you want this job. That part has to be in your own words." }],
    });
    expect(note.subject).toBe("1 job is ready to apply");
    expect(note.text).toContain("- Tax Operations Intern at Coinbase");
    expect(note.text).toContain("- Accounting Intern at Akuna Capital. Add one or two sentences on why you want this job.");
    expect(note.text).toContain("/app/ready to read them and apply. Proofline never applies for you.");
    expect(note.text).not.toMatch(/https?:\/\/[^\s]*\?/);
    expect(digestEmail({ ready: [], needsYou: [{ title: "A", company: "B", reason: null }] }).subject).toBe("Proofline: 1 waiting on you");
    expect(digestEmail({ ready: [{ title: "A", company: "B", reason: null }, { title: "C", company: "D", reason: null }], needsYou: [] }).subject).toBe("2 jobs are ready to apply");
  });
});
