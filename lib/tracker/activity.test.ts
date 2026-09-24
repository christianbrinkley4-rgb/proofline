import { describe, expect, it } from "vitest";
import { parseApplicationActivity, REPLY_STAGE, ReplySchema } from "./activity";

describe("application activity", () => {
  const at = new Date("2026-09-23T12:00:00Z");
  it("validates a recorded reply and maps meaningful outcomes to stages", () => {
    expect(ReplySchema.safeParse({ kind: "interview", summary: "  Recruiter invited me to meet the team.  " }).success).toBe(true);
    expect(ReplySchema.safeParse({ kind: "interview", summary: " " }).success).toBe(false);
    expect(REPLY_STAGE.interview).toBe("interview");
    expect(REPLY_STAGE.update).toBeUndefined();
  });
  it("builds a safe timeline from stage, reply, resume, and follow-up events", () => {
    const items = parseApplicationActivity([
      { id: "1", type: "application_stage_changed", data: { applicationId: "a", from: null, to: "saved" }, createdAt: at },
      { id: "2", type: "resume_linked", data: { applicationId: "a", resumeId: "r" }, createdAt: new Date(at.getTime() + 1000) },
      { id: "3", type: "application_reply_recorded", data: { applicationId: "a", kind: "interview", summary: "Thursday at 2." }, createdAt: new Date(at.getTime() + 2000) },
      { id: "4", type: "follow_up_recorded", data: { applicationId: "a", subject: "Checking in", body: "Hello" }, createdAt: new Date(at.getTime() + 3000) },
      { id: "5", type: "application_stage_changed", data: { applicationId: "a", from: "saved", to: "invalid" }, createdAt: at },
    ]);
    expect(items.map((item) => item.type)).toEqual(["followup", "reply", "resume", "stage"]);
    expect(items[1]).toMatchObject({ title: "Interview invitation recorded", detail: "Thursday at 2." });
    expect(items[3].title).toBe("Saved opportunity");
  });
});
