import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { addListFacts, saveEducation, saveRole } from "@/lib/facts/base";
import { updateProfile } from "@/lib/kb/profile";
import { upsertJobs } from "@/lib/jobs/store";
import { kitFields } from "./kit";
import { loadAnswerKit } from "./kit-service";
import { markSubmitted, readSent } from "./sent";
import { draftAnswer } from "./service";

const userId = randomUUID();
let jobId = "";

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values({ id: userId, name: "Casey Morgan", email: `kit-${userId}@example.invalid` });
  await updateProfile(userId, { fullName: "Casey Morgan", city: "Durham", region: "NC", contactEmail: "casey@example.invalid", workAuthorization: "us_citizen", openToRelocate: false });
  await saveEducation(userId, [{ school: "UNC Greensboro", degree: "Bachelor of Science", major: "Accounting", gradDate: "2026-12", gpa: "3.69" }]);
  await saveRole(userId, { kind: "work", org: "City Clinic", title: "Front Desk", startDate: "2024-01", endDate: "2024-06", bullets: ["Scheduled appointments for 3 dentists", "Reconciled 40 patient accounts each week in Excel"] });
  await addListFacts(userId, "skill", ["Excel", "QuickBooks"]);
  const [job] = (await upsertJobs([{
    source: "link", sourceId: `kit-${userId}`, company: "Northwind Tax", title: "Tax Intern",
    location: "Raleigh, NC", mode: "onsite", level: "internship", url: `https://job-boards.greenhouse.io/northwind/jobs/${Date.now()}`,
    description: "Responsibilities: Prepare individual tax returns and reconcile client accounts in Excel each week during tax season. Qualifications: Pursuing a degree in accounting. Excel required. Strong communication with clients and the tax team. This is a paid spring internship in our Raleigh office.",
    department: null, employmentType: null, payMin: null, payMax: null, payPeriod: null, postedAt: null,
  }])).values();
  jobId = job.id;
  await db.insert(schema.jobMatch).values({ userId, jobId, status: "saved" });
}, 60_000);

describe("answer kit and what you sent", () => {
  it("builds a kit from confirmed facts, blank where nothing is confirmed, in well under 3 seconds", async () => {
    const started = performance.now();
    const loaded = await loadAnswerKit(userId, jobId);
    expect(performance.now() - started).toBeLessThan(3000);
    const fields = new Map(kitFields(loaded!.kit).map((f) => [f.key, f]));
    expect(fields.get("contact.first")?.value).toBe("Casey");
    expect(fields.get("contact.email")?.value).toBe("casey@example.invalid");
    expect(fields.get("contact.phone")?.blank?.kind).toBe("no_fact");
    expect(fields.get("eligibility.authorized")?.value).toBe("Yes");
    expect(fields.get("eligibility.relocate")?.value).toBe("No");
    expect(fields.get("eligibility.start")?.blank?.kind).toBe("no_fact");
    const work = [...fields.values()].find((f) => f.key.endsWith(".description") && f.key.startsWith("work."));
    expect(work?.value).toContain("Reconciled 40 patient accounts each week in Excel");
    expect(work?.sources.every((s) => s.kind === "fact")).toBe(true);
    expect(fields.get("skills.list")?.value).toBe("Excel, QuickBooks");
    expect(loaded!.kit.blankCount).toBeGreaterThan(0);
  });

  it("includes a drafted form answer with the facts it came from", async () => {
    await draftAnswer(userId, jobId, "What experience do you have with Excel?");
    const loaded = await loadAnswerKit(userId, jobId);
    const answer = loaded!.kit.groups.find((g) => g.key === "questions")!.entries[0].fields[0];
    expect(answer.label).toBe("What experience do you have with Excel?");
    expect(answer.value).toContain("Excel");
    expect(answer.sources.some((s) => s.kind === "fact" && s.text.includes("Excel"))).toBe(true);
  });

  it("refuses a stale kit, then saves exactly the kit the person saw and moves the job to Applied", async () => {
    const before = await loadAnswerKit(userId, jobId);
    await updateProfile(userId, { phone: "919-555-0101" });
    expect(await markSubmitted(userId, jobId, before!.kit.digest)).toEqual({ ok: false, reason: "stale" });
    const none = await db.query.application.findFirst({ where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)) });
    expect(none).toBeUndefined();

    const current = await loadAnswerKit(userId, jobId);
    const result = await markSubmitted(userId, jobId, current!.kit.digest);
    expect(result.ok).toBe(true);
    const app = await db.query.application.findFirst({ where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)) });
    expect(app?.stage).toBe("applied");
    expect(app?.nextFollowUpAt).toBeTruthy();
    const record = readSent(app?.sent);
    expect(record?.kit).toEqual(current!.kit);

    // A second mark keeps the first record.
    expect(await markSubmitted(userId, jobId, current!.kit.digest)).toEqual({ ok: false, reason: "already" });
    await updateProfile(userId, { phone: "919-555-0199" });
    const after = await db.query.application.findFirst({ where: eq(schema.application.id, app!.id) });
    expect(readSent(after?.sent)?.kit.digest).toBe(current!.kit.digest);
    expect(kitFields(readSent(after?.sent)!.kit).find((f) => f.key === "contact.phone")?.value).toBe("919-555-0101");
  });
});
