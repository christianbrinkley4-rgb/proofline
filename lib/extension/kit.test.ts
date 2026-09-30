import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as appliedRoute } from "@/app/api/extension/applied/route";
import { POST as kitRoute } from "@/app/api/extension/kit/route";
import { createToken } from "@/lib/agent/tokens";
import { db, dbReady, schema } from "@/lib/db";
import { saveEducation, saveRole } from "@/lib/facts/base";
import { updateProfile } from "@/lib/kb/profile";
import { upsertJobs } from "@/lib/jobs/store";
import { readSent } from "@/lib/packet/sent";
import { atsKey } from "./kit";
import { EXTENSION_TOKEN_NAME } from "./service";

const userId = randomUUID();
const otherId = randomUUID();
let token = "";
let jobId = "";
const GH_ID = String(Date.now()).slice(-10);

const call = (path: string, body: unknown, auth = token) =>
  new Request(`http://localhost:3000${path}`, { method: "POST", body: JSON.stringify(body), headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" } });

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values([
    { id: userId, name: "Kit Tester", email: `kit-ext-${userId}@example.invalid` },
    { id: otherId, name: "Other", email: `kit-ext-${otherId}@example.invalid` },
  ]);
  await updateProfile(userId, { fullName: "Riley Chen", contactEmail: "riley@example.invalid", phone: "919-555-0100", workAuthorization: "authorized" });
  await saveEducation(userId, [{ school: "NC State University", degree: "Bachelor of Science", major: "Accounting", gradDate: "2027-05" }]);
  await saveRole(userId, { kind: "work", org: "Campus Bookstore", title: "Cashier", startDate: "2025-01", endDate: "", bullets: ["Balanced a cash drawer of $2,000 each shift"] });
  token = (await createToken(userId, EXTENSION_TOKEN_NAME)).token;
  const [job] = (await upsertJobs([{
    source: "link", sourceId: `kit-ext-${userId}`, company: "Northwind Tax", title: "Tax Intern", location: "Raleigh, NC", mode: "onsite", level: "internship",
    url: `https://job-boards.greenhouse.io/northwind/jobs/${GH_ID}`,
    description: "Responsibilities: Prepare tax returns and reconcile client accounts in Excel. Qualifications: Pursuing a degree in accounting. Excel required. Clear communication with clients. Paid spring internship in Raleigh.",
    department: null, employmentType: null, payMin: null, payMax: null, payPeriod: null, postedAt: null,
  }])).values();
  jobId = job.id;
  await db.insert(schema.jobMatch).values({ userId, jobId, status: "saved" });
}, 60_000);

describe("posting identity from an application page", () => {
  it.each([
    ["https://job-boards.greenhouse.io/northwind/jobs/12345", "greenhouse:12345"],
    ["https://boards.greenhouse.io/northwind/jobs/12345?gh_src=abc", "greenhouse:12345"],
    ["https://job-boards.greenhouse.io/embed/job_app?for=northwind&token=12345", "greenhouse:12345"],
    ["https://www.northwind.com/careers/12345?gh_jid=12345", "greenhouse:12345"],
    ["https://jobs.lever.co/northwind/0B0C0D0E-0000-4000-8000-000000000001/apply", "lever:0b0c0d0e-0000-4000-8000-000000000001"],
    ["https://jobs.lever.co/northwind", null],
    ["https://www.linkedin.com/jobs/view/12345", null],
    ["not a url", null],
  ])("%s", (url, key) => {
    expect(atsKey(url)).toBe(key);
  });
});

describe("the extension's answer kit", () => {
  it("finds the saved job from its embedded application form and returns only kit answers", async () => {
    const res = await kitRoute(call("/api/extension/kit", { url: `https://www.northwind.com/careers/apply?gh_jid=${GH_ID}` }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.plan.jobId).toBe(jobId);
    const answers = Object.fromEntries(body.plan.answers.map((a: { key: string; value: string }) => [a.key, a.value]));
    expect(answers["contact.first"]).toBe("Riley");
    expect(answers["contact.email"]).toBe("riley@example.invalid");
    expect(answers["eligibility.authorized"]).toBe("Yes");
    expect(answers["eligibility.sponsorship"]).toBe("No");
    expect(body.plan.blanks.map((b: { key: string }) => b.key)).toContain("eligibility.start");
    expect(body.plan.kitUrl).toBe(`http://localhost:3000/app/jobs/${jobId}/kit`);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("says a job isn't saved yet, and fills each person's kit only from their own facts", async () => {
    const mine = await kitRoute(call("/api/extension/kit", { url: "https://jobs.lever.co/acme/0b0c0d0e-0000-4000-8000-000000000009/apply" }));
    expect(mine.status).toBe(404);
    expect((await mine.json()).notSaved).toBe(true);
    // The posting is public, so another account may open it, but its kit is built from that account's facts.
    const other = (await createToken(otherId, EXTENSION_TOKEN_NAME)).token;
    const theirs = await (await kitRoute(call("/api/extension/kit", { url: `https://job-boards.greenhouse.io/northwind/jobs/${GH_ID}`, jobId }, other))).json();
    expect(JSON.stringify(theirs.plan.answers)).not.toMatch(/Riley|riley@|Campus Bookstore/);
    // Without the job id, the page alone only finds jobs on the caller's own account.
    const byPage = await kitRoute(call("/api/extension/kit", { url: `https://job-boards.greenhouse.io/northwind/jobs/${GH_ID}` }, other));
    expect(byPage.status).toBe(404);
  });

  it("keeps the kit it filled from when the person says they submitted", async () => {
    const { plan } = await (await kitRoute(call("/api/extension/kit", { url: `https://job-boards.greenhouse.io/northwind/jobs/${GH_ID}` }))).json();
    const done = await (await appliedRoute(call("/api/extension/applied", { jobId, digest: plan.digest }))).json();
    expect(done).toMatchObject({ ok: true, recorded: "sent" });
    const app = await db.query.application.findFirst({ where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)) });
    expect(app?.stage).toBe("applied");
    expect(readSent(app?.sent)?.kit.digest).toBe(plan.digest);
    const again = await (await appliedRoute(call("/api/extension/applied", { jobId, digest: plan.digest }))).json();
    expect(again).toMatchObject({ ok: true, recorded: "already" });
  });
});
