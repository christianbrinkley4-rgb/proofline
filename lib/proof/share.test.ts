import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import type { ResumeDocument } from "@/lib/resume/document";

// The review gate needs a real model pass; here the test decides whether it passed.
const gate = vi.hoisted(() => ({ canExport: true }));
vi.mock("@/lib/review/gate", () => ({
  gateStatus: vi.fn(async () => ({ canExport: gate.canExport, review: gate.canExport ? { at: "2026-09-28T12:00:00.000Z" } : null, reason: gate.canExport ? null : "Run the review." })),
}));

const { proofView, shareResume, ShareNotReady, stopSharing } = await import("./share");

const userId = randomUUID();
let resumeId: string;

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values({ id: userId, name: "Jordan Reyes", email: `proof-${userId}@example.invalid` });
  const [experience] = await db.insert(schema.experience).values({ userId, kind: "work", org: "Oakwood Family Dental" }).returning();
  const [own, imported] = await db
    .insert(schema.fact)
    .values([
      { userId, experienceId: experience.id, category: "experience", content: "Reconciled 40+ vendor accounts a month in QuickBooks", source: "user_stated", verificationState: "confirmed", confirmedAt: new Date("2026-09-20") },
      { userId, experienceId: experience.id, category: "experience", content: "Trained two front-desk hires on billing", source: "resume_parsed", verificationState: "confirmed", confirmedAt: new Date("2026-09-21") },
    ])
    .returning();
  const [b1, b2] = await db
    .insert(schema.bullet)
    .values([
      { userId, experienceId: experience.id, text: own.content, status: "active", factIds: [own.id], generator: "user" },
      { userId, experienceId: experience.id, text: "Trained 2 new front-desk hires on the billing workflow", status: "active", factIds: [imported.id], generator: "anthropic" },
    ])
    .returning();
  const document: ResumeDocument = {
    header: { name: "Jordan Reyes", contact: ["Raleigh, NC", "jordan@example.com", "(919) 555-0142"] },
    sections: [
      { kind: "education", title: "Education", entries: [{ school: "NC State University", location: null, degreeLine: "BS in Accounting", gradLine: "May 2028", details: [] }] },
      { kind: "entries", title: "Experience", entries: [{ experienceId: experience.id, org: "Oakwood Family Dental", title: "Bookkeeping Assistant", location: "Raleigh, NC", dates: "May 2025 to Present", bullets: [{ id: b1.id, text: b1.text, factIds: b1.factIds }, { id: b2.id, text: b2.text, factIds: b2.factIds }] }] },
      { kind: "skills", title: "Skills", lines: [{ label: "Tools", items: ["QuickBooks", "Excel"] }] },
    ],
  };
  const [resume] = await db.insert(schema.resume).values({ userId, name: "Tailored", template: "classic", variant: "experience", content: { document } }).returning();
  resumeId = resume.id;
}, 60_000);

beforeEach(() => {
  gate.canExport = true;
});

describe("proof links", () => {
  it("won't share a resume until its review passes", async () => {
    gate.canExport = false;
    await expect(shareResume(userId, resumeId)).rejects.toBeInstanceOf(ShareNotReady);
  });

  it("shows each line with how it was worded and the confirmed fact behind it, and no contact details", async () => {
    const share = await shareResume(userId, resumeId);
    expect((await shareResume(userId, resumeId)).slug).toBe(share.slug);

    const view = await proofView(share.slug);
    if (view.state !== "ok") throw new Error(`expected ok, got ${view.state}`);
    expect(view).toMatchObject({ name: "Jordan Reyes", firstName: "Jordan", reviewedAt: "2026-09-28T12:00:00.000Z", bulletCount: 2 });
    const [bullet1, bullet2] = view.sections[1].entries![0].bullets;
    expect(bullet1).toMatchObject({ wording: "own", sources: [{ text: "Reconciled 40+ vendor accounts a month in QuickBooks", origin: "own_words" }] });
    expect(bullet2).toMatchObject({ wording: "ai", sources: [{ text: "Trained two front-desk hires on billing", origin: "uploaded_resume" }] });
    expect(view.sections[2].lines).toEqual(["Tools: QuickBooks, Excel"]);
    expect(JSON.stringify(view)).not.toMatch(/jordan@example\.com|555-0142/);
  });

  it("stops vouching when the resume no longer passes, and when sharing stops", async () => {
    const share = await shareResume(userId, resumeId);
    gate.canExport = false;
    expect(await proofView(share.slug)).toEqual({ state: "changed", firstName: "Jordan" });
    gate.canExport = true;
    await stopSharing(userId, resumeId);
    expect(await proofView(share.slug)).toEqual({ state: "missing" });
  });

  it("treats a malformed or unknown slug as missing", async () => {
    expect(await proofView("../etc/passwd")).toEqual({ state: "missing" });
    expect(await proofView("a".repeat(24))).toEqual({ state: "missing" });
  });
});
