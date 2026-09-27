import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/lib/db";
import { offlineReply } from "@/lib/agent/offline";
import { runTool } from "@/lib/agent/tools";
import { parseApplicationActivity, ReplySchema } from "./activity";
import { deleteApplication, listApplicationOutcomes, recordReply } from "./service";

const userId = randomUUID();
const otherId = randomUUID();
let applicationId: string;
let resumeId: string;

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values([
    { id: userId, name: "Outcome tester", email: `outcome-${userId}@example.invalid` },
    { id: otherId, name: "Other tester", email: `outcome-${otherId}@example.invalid` },
  ]);
  const [resume] = await db.insert(schema.resume).values({
    userId, name: "Submitted resume", template: "classic", variant: "experience", content: {},
  }).returning();
  resumeId = resume.id;
  const [application] = await db.insert(schema.application).values({
    userId, company: "Northwind", title: "Analyst", stage: "applied",
    appliedAt: new Date("2026-09-25T12:00:00Z"), sortOrder: 1, resumeId,
  }).returning();
  applicationId = application.id;
}, 60_000);

describe("recorded application outcomes", () => {
  it("ties a reported reply to the submitted version and keeps improvement consent off by default", async () => {
    await expect(recordReply(otherId, applicationId, { kind: "interview", summary: "They invited me to meet the team." })).rejects.toThrow("Apply before recording a reply.");
    await recordReply(userId, applicationId, {
      kind: "interview", summary: "They invited me to meet the team.",
      whatHelped: "Maybe my inventory project lined up.",
      nextTime: "Practice one example of prioritizing work.",
    });
    const event = await db.query.agentEvent.findFirst({
      where: and(eq(schema.agentEvent.userId, userId), eq(schema.agentEvent.type, "application_reply_recorded")),
    });
    expect(event?.data).toMatchObject({
      applicationId, resumeId, kind: "interview", reportedByUser: true,
      outcomeEvidence: true, consentToImprove: false,
      nextTime: "Practice one example of prioritizing work.",
    });
    const app = await db.query.application.findFirst({ where: eq(schema.application.id, applicationId) });
    expect(app?.stage).toBe("interview");
    const activity = parseApplicationActivity([event!]);
    expect(activity[0]).toMatchObject({ whatHelped: "Maybe my inventory project lined up.", nextTime: "Practice one example of prioritizing work." });
  });

  it("gives only the account owner their self-reported outcomes and avoids causal claims", async () => {
    const own = await listApplicationOutcomes(userId);
    expect(own).toContainEqual(expect.objectContaining({ applicationId, resumeId, kind: "interview" }));
    expect(await listApplicationOutcomes(otherId)).toEqual([]);
    const tool = await runTool("get_application_outcomes", {}, { userId, email: "owner@example.invalid", client: "Proofline" }) as {
      outcomes: Array<{ applicationId: string }>; interpretation: string;
    };
    expect(tool.outcomes[0].applicationId).toBe(applicationId);
    expect(tool.interpretation).toMatch(/cannot establish/);
    const other = await runTool("get_application_outcomes", {}, { userId: otherId, email: "other@example.invalid", client: "Proofline" }) as { outcomes: unknown[] };
    expect(other.outcomes).toEqual([]);
    const reply = await offlineReply("What have I learned from my applications?", { userId, email: "owner@example.invalid", client: "Proofline" });
    expect(reply.text).toContain("Practice one example of prioritizing work.");
    expect(reply.text).toMatch(/not proof/);
    expect(reply.tools).toContainEqual({ name: "get_application_outcomes", ok: true });
    const noInterview = await offlineReply("Why am I not getting interviews?", { userId: otherId, email: "other@example.invalid", client: "Proofline" });
    expect(noInterview.tools).toContainEqual({ name: "get_application_outcomes", ok: true });
  });

  it("persists explicit consent and removes outcome history when the application is deleted", async () => {
    expect(ReplySchema.parse({ kind: "rejection", summary: "Position filled." }).consentToImprove).toBe(false);
    await recordReply(userId, applicationId, { kind: "rejection", summary: "Position filled.", consentToImprove: true });
    const events = await db.query.agentEvent.findMany({
      where: and(eq(schema.agentEvent.userId, userId), eq(schema.agentEvent.type, "application_reply_recorded")),
    });
    expect(events.find((event) => event.data.kind === "rejection")?.data)
      .toMatchObject({ kind: "rejection", consentToImprove: true, reportedByUser: true });
    await deleteApplication(userId, applicationId);
    expect(await listApplicationOutcomes(userId)).toEqual([]);
    const leftover = await db.query.agentEvent.findMany({
      where: and(eq(schema.agentEvent.userId, userId), eq(schema.agentEvent.type, "application_reply_recorded")),
    });
    expect(leftover).toEqual([]);
  });
});

