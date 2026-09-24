import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { upsertJobs } from "@/lib/jobs/store";
import { addManualApplication, getApplication, linkManualApplication } from "@/lib/tracker/service";
import { pastedJob, PastedJobSchema } from "./pasted";

const DESCRIPTION = `Acme Health is hiring a Staff Accountant Intern for Summer 2027 in our Raleigh office. This is a hybrid role.
Responsibilities: reconcile general ledger accounts, prepare journal entries, and support the month-end close.
Qualifications: pursuing a degree in accounting; proficiency in Excel. Pay: $22 - $25/hour.`;

describe("pasted jobs", () => {
  it("reads mode, level, and pay from what was pasted", () => {
    const job = pastedJob("user-1", { company: "Acme Health", title: "Staff Accountant Intern", description: DESCRIPTION });
    expect(job).toMatchObject({ source: "link", mode: "hybrid", level: "internship", payMin: 22, payMax: 25, payPeriod: "hour", url: "" });
    expect(job.sourceId).toMatch(/^pasted:[0-9a-f]{24}$/);
  });

  it("keys a posting to the student who pasted it", () => {
    const a = pastedJob("user-1", { company: "Acme", title: "Intern", description: DESCRIPTION });
    const b = pastedJob("user-2", { company: "Acme", title: "Intern", description: DESCRIPTION });
    expect(a.sourceId).not.toBe(b.sourceId);
  });

  it("asks for enough of the posting to score", () => {
    expect(PastedJobSchema.safeParse({ company: "Acme", title: "Intern", description: "Short." }).success).toBe(false);
    expect(PastedJobSchema.safeParse({ company: "Acme", title: "Intern", description: DESCRIPTION, url: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("linking a manual tracker entry", () => {
  const userId = "test-user-pasted";
  beforeAll(async () => {
    await dbReady;
    await db.insert(schema.user).values({ id: userId, name: "Paster", email: "paster@example.com" }).onConflictDoNothing();
  }, 60_000);

  it("attaches the pasted posting to the entry with the same company and title", async () => {
    const manual = await addManualApplication(userId, { company: "Acme Health", title: "Staff Accountant Intern" });
    const rows = await upsertJobs([pastedJob(userId, { company: "ACME health", title: "Staff Accountant Intern", description: DESCRIPTION })]);
    const job = [...rows.values()][0];
    expect(await linkManualApplication(userId, job)).toBe(manual.id);
    expect((await getApplication(userId, manual.id))?.jobId).toBe(job.id);
    expect(await linkManualApplication(userId, job)).toBeNull();
  });
});
