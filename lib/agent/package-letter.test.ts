import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/lib/db";
import { saveEducation, saveRole } from "@/lib/facts/base";
import { refreshFeed } from "@/lib/jobs/feed/refresh";
import { updateProfile } from "@/lib/kb/profile";
import type { NormalizedJob } from "@/lib/jobs/types";
import { getPacket, readLetter, saveCoverLetter, saveWhy } from "@/lib/packet/service";
import { addReasonToRun } from "./add-reason";
import { packageLetter } from "./package-letter";

const NOW = new Date();
const posting: NormalizedJob = {
  source: "greenhouse",
  sourceId: "lettercoo:1",
  company: "LetterCo",
  title: "Staff Accountant",
  location: "Raleigh, NC",
  mode: "onsite",
  level: "entry",
  url: "https://example.com/letterco/1",
  description: `Requirements:\n- Excel\n- Reconciliations\nBachelor's degree in Accounting.\n\n${"You will join a small team, learn the close process, and work with people across the company every week. ".repeat(5)}`,
  department: "Finance",
  employmentType: null,
  payMin: null,
  payMax: null,
  payPeriod: null,
  postedAt: new Date(NOW.getTime() - 5 * 864e5),
};

const userId = "letter-package-user";
let jobId = "";

const modelSays = (verdict: "PASS" | "FAIL", issues: Array<{ quote: string; rule_broken: string; fix: string }> = []) => {
  vi.stubEnv("PROOFLINE_REVIEW_KEY", "test-key");
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ verdict, issues }) }] } }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("packaging the cover letter for a role", () => {
  beforeAll(async () => {
    await dbReady;
    await refreshFeed({ boards: [{ source: "greenhouse", slug: "lettercoo", company: "LetterCo" }], now: NOW, fetch: async () => [posting] });
    const job = await db.query.job.findFirst({ where: and(eq(schema.job.source, "greenhouse"), eq(schema.job.sourceId, "lettercoo:1")) });
    jobId = job!.id;
    await db.insert(schema.user).values({ id: userId, name: "Sam Lee", email: "sam-letter@example.com" }).onConflictDoNothing();
    await updateProfile(userId, { fullName: "Sam Lee", gradDate: "2026-12", workAuthorization: "permanent_resident", targetLocations: ["Raleigh, NC"], targetRoles: ["accounting"] });
    await saveEducation(userId, [{ school: "UNC Greensboro", degree: "BS", major: "Accounting", gradDate: "2026-12" }]);
    await saveRole(userId, {
      kind: "work",
      org: "Tax Office",
      title: "Intern",
      startDate: "2025-06",
      endDate: "2025-08",
      bullets: ["Reconciled 40 vendor accounts each month in Excel", "Flagged 3 duplicate payments before the month-end review"],
    });
  }, 60_000);

  it("drafts from confirmed facts and stops for the person's own reason without spending a review", async () => {
    const fetchMock = modelSays("PASS");
    const outcome = await packageLetter(userId, jobId);
    expect(outcome).toMatchObject({ ok: false, needs: "why" });
    expect(outcome.ok === false && outcome.reason).toBe("Add one or two sentences on why you want this job. That part has to be in your own words.");
    expect(fetchMock).not.toHaveBeenCalled();
    const packet = await getPacket(userId, jobId);
    const letter = readLetter(packet);
    expect(letter?.paragraphs.some((p) => p.purpose === "evidence" && /Reconciled|reconciled/.test(p.text))).toBe(true);
    expect(letter?.paragraphs.find((p) => p.purpose === "motivation")?.text).toMatch(/^\[Add one or two sentences/);
    expect(packet?.why).toBeNull();
  });

  it("passes once the person has written why, using their words as written", async () => {
    await saveWhy(userId, jobId, "I read how LetterCo closes its books every week and I want to learn that close process from the team that built it.");
    const fetchMock = modelSays("PASS");
    expect(await packageLetter(userId, jobId)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const packet = await getPacket(userId, jobId);
    expect(readLetter(packet)?.paragraphs.find((p) => p.purpose === "motivation")?.text).toBe("I read how LetterCo closes its books every week and I want to learn that close process from the team that built it.");
    expect(packet?.letterReview).toMatchObject({ version: 1, passed: true, model: { status: "pass" } });
  });

  it("says what to fix when the model flags a line, and keeps the verdict beside the letter", async () => {
    const letter = readLetter(await getPacket(userId, jobId))!;
    modelSays("FAIL", [{ quote: letter.paragraphs.find((p) => p.purpose === "fit")!.text, rule_broken: "says nothing specific", fix: "Name something from the posting" }]);
    const outcome = await packageLetter(userId, jobId);
    expect(outcome).toEqual({ ok: false, reason: "The final read-through of the cover letter flagged a line to fix." });
    expect((await getPacket(userId, jobId))?.letterReview).toMatchObject({ passed: false, model: { status: "fail" } });
  });

  it("never redrafts a letter the person edited", async () => {
    const letter = readLetter(await getPacket(userId, jobId))!;
    const edited = { ...letter, paragraphs: letter.paragraphs.map((p) => (p.purpose === "closing" ? { ...p, text: "Thank you for reading. I would be glad to talk any time that suits you." } : p)) };
    await saveCoverLetter(userId, jobId, edited);
    expect(readLetter(await getPacket(userId, jobId))?.generator).toBe("user");
    const fetchMock = modelSays("PASS");
    expect(await packageLetter(userId, jobId)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readLetter(await getPacket(userId, jobId))?.paragraphs.find((p) => p.purpose === "closing")?.text).toBe("Thank you for reading. I would be glad to talk any time that suits you.");
  });

  it("is not ready when the reviewer is unavailable", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "");
    const outcome = await packageLetter(userId, jobId);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toMatch(/temporarily unavailable/);
  });
});

describe("adding a reason to a role that is waiting on it", () => {
  // Each test starts from a fresh draft, not the edited letter the one above leaves behind.
  beforeEach(async () => {
    await db.delete(schema.applicationPacket).where(and(eq(schema.applicationPacket.userId, userId), eq(schema.applicationPacket.jobId, jobId)));
  });

  const runFor = async (id: string) => {
    const [row] = await db
      .insert(schema.agentRun)
      .values({
        userId,
        jobId,
        status: "needs_you",
        reason: "Add one or two sentences on why you want this job. That part has to be in your own words.",
        steps: [
          { step: "review", ok: true, note: "The resume passed the review against your facts and this posting.", at: new Date().toISOString() },
          { step: "letter", ok: false, note: "Add one or two sentences on why you want this job.", at: new Date().toISOString(), needs: "why" },
        ],
      })
      .onConflictDoUpdate({ target: [schema.agentRun.userId, schema.agentRun.jobId], set: { status: "needs_you", dismissedAt: null, steps: [] } })
      .returning({ id: schema.agentRun.id });
    void id;
    return row.id;
  };

  it("saves the reason as written, rebuilds the letter, and makes the role ready when the review passes", async () => {
    const runId = await runFor("a");
    modelSays("PASS");
    await db.update(schema.agentRun).set({ steps: [{ step: "letter", ok: false, note: "x", at: new Date().toISOString(), needs: "why" }] }).where(eq(schema.agentRun.id, runId));
    const result = await addReasonToRun(userId, runId, "I read how LetterCo closes its books every week and I want to learn that close process from the team that built it.");
    expect(result).toEqual({ ok: true, status: "ready", reason: null });
    const run = await db.query.agentRun.findFirst({ where: eq(schema.agentRun.id, runId) });
    expect(run).toMatchObject({ status: "ready", reason: null });
    expect((run!.steps as Array<{ step: string; ok: boolean }>).at(-1)).toMatchObject({ step: "letter", ok: true });
  });

  it("keeps the role waiting, with the new reason, when the letter still does not pass", async () => {
    const runId = await runFor("b");
    modelSays("FAIL", [{ quote: "Thank you for your time and consideration.", rule_broken: "boilerplate", fix: "End with a specific next step" }]);
    const result = await addReasonToRun(userId, runId, "I read how LetterCo closes its books every week and I want to learn that close process from the team that built it.");
    expect(result).toEqual({ ok: true, status: "needs_you", reason: "The final read-through of the cover letter flagged a line to fix." });
    const run = await db.query.agentRun.findFirst({ where: eq(schema.agentRun.id, runId) });
    expect(run?.status).toBe("needs_you");
  });

  it("refuses a reason that is too thin or reads like a template, without touching the role", async () => {
    const runId = await runFor("c");
    expect(await addReasonToRun(userId, runId, "Looks good")).toMatchObject({ ok: false, error: expect.stringContaining("sentence or two") });
    expect(await addReasonToRun(userId, runId, "I am passionate about accounting and excited to apply to LetterCo.")).toMatchObject({ ok: false, error: expect.stringContaining("reads like a template") });
    expect((await db.query.agentRun.findFirst({ where: eq(schema.agentRun.id, runId) }))?.status).toBe("needs_you");
  });

  it("only works on the person's own role that is still waiting", async () => {
    const runId = await runFor("d");
    const reason = "I read how LetterCo closes its books every week and I want to learn that close process from the team that built it.";
    expect(await addReasonToRun("someone-else", runId, reason)).toMatchObject({ ok: false });
    await db.update(schema.agentRun).set({ dismissedAt: new Date() }).where(eq(schema.agentRun.id, runId));
    expect(await addReasonToRun(userId, runId, reason)).toMatchObject({ ok: false });
    await db.update(schema.agentRun).set({ dismissedAt: null }).where(eq(schema.agentRun.id, runId));
  });
});
