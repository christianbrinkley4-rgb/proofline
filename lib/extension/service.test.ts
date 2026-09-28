import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as appliedRoute } from "@/app/api/extension/applied/route";
import { POST as jobsRoute } from "@/app/api/extension/jobs/route";
import { GET as profileRoute } from "@/app/api/extension/profile/route";
import { createToken, revokeToken } from "@/lib/agent/tokens";
import { db, dbReady, schema } from "@/lib/db";
import { updateProfile } from "@/lib/kb/profile";
import { EXTENSION_TOKEN_NAME } from "./service";

const userId = randomUUID();
const email = `ext-${userId}@example.invalid`;
let token: string;

const call = (path: string, init: RequestInit = {}, auth = token) =>
  new Request(`http://localhost:3000${path}`, { ...init, headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" } });

const POSTING = {
  url: "https://boards.example.com/acme/jobs/123",
  title: "Staff Accountant Intern",
  company: "Acme Health",
  location: "Raleigh, NC",
  description:
    "You will reconcile vendor accounts, record journal entries, and prepare month-end close schedules in QuickBooks and Excel. " +
    "Requirements: currently pursuing a degree in accounting, experience with Excel, and strong attention to detail. This is a paid summer internship.",
};

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values({ id: userId, name: "Ext Tester", email });
  await updateProfile(userId, { fullName: "Jordan Q Reyes", phone: "(919) 555-0142", city: "Raleigh", region: "NC", school: "NC State University", gradDate: "2028-05", gpa: 3.6 });
  token = (await createToken(userId, EXTENSION_TOKEN_NAME)).token;
}, 60_000);

describe("browser extension API", () => {
  it("gives the extension only form basics, from the person's profile", async () => {
    const res = await profileRoute(call("/api/extension/profile"));
    const body = await res.json();
    expect(body.profile).toEqual({
      fullName: "Jordan Q Reyes", firstName: "Jordan", lastName: "Reyes", email, phone: "(919) 555-0142", city: "Raleigh", region: "NC",
      linkedin: "", website: "", school: "NC State University", degree: "", major: "", graduation: "May 2028", gpa: "3.6",
    });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("saves a captured posting with a fit score, then records it as applied", async () => {
    const saved = await (await jobsRoute(call("/api/extension/jobs", { method: "POST", body: JSON.stringify(POSTING) }))).json();
    expect(saved).toMatchObject({ ok: true, title: "Staff Accountant Intern", company: "Acme Health" });
    expect(saved.url).toBe(`http://localhost:3000/app/jobs/${saved.jobId}`);

    const done = await (await appliedRoute(call("/api/extension/applied", { method: "POST", body: JSON.stringify({ jobId: saved.jobId }) }))).json();
    expect(done.ok).toBe(true);
    const app = await db.query.application.findFirst({ where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, saved.jobId)) });
    expect(app?.stage).toBe("applied");
    expect(app?.nextFollowUpAt).toBeTruthy();

    // Saying so twice doesn't make a second application.
    await appliedRoute(call("/api/extension/applied", { method: "POST", body: JSON.stringify({ jobId: saved.jobId }) }));
    expect(await db.query.application.findMany({ where: eq(schema.application.userId, userId) })).toHaveLength(1);
  });

  it("refuses a posting too thin to score, and a job that isn't the person's", async () => {
    const thin = await jobsRoute(call("/api/extension/jobs", { method: "POST", body: JSON.stringify({ ...POSTING, description: "Short." }) }));
    expect(thin.status).toBe(400);
    const stranger = await appliedRoute(call("/api/extension/applied", { method: "POST", body: JSON.stringify({ jobId: randomUUID() }) }));
    expect(stranger.status).toBe(404);
  });

  it("rejects a missing, wrong, or revoked token", async () => {
    expect((await profileRoute(call("/api/extension/profile", {}, "pl_not-a-real-token"))).status).toBe(401);
    const { token: other, row } = await createToken(userId, EXTENSION_TOKEN_NAME);
    await revokeToken(userId, row.id);
    expect((await profileRoute(call("/api/extension/profile", {}, other))).status).toBe(401);
    expect((await profileRoute(new Request("http://localhost:3000/api/extension/profile"))).status).toBe(401);
  });
});
