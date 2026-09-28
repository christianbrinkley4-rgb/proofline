import { describe, expect, it } from "vitest";
import { followUpDraft, followUpState, stagePatch, trackerStats, type Application } from "./model";

const application = (overrides: Partial<Application> = {}): Application => ({
  id: "1", userId: "u", jobId: null, company: "Northwind", title: "Analyst", url: null,
  stage: "saved", resumeId: null, appliedAt: null, stageChangedAt: new Date("2026-09-01T00:00:00Z"),
  nextFollowUpAt: null, followUpSentAt: null, confirmationRef: null, deadline: null, notes: null, contacts: null, sortOrder: 0,
  createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z"),
  ...overrides,
});
describe("follow-ups", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const submitted = new Date("2026-09-27T12:00:00Z");
  it("comes due 14 days after the application, and leaves the due state once marked sent", () => {
    const patch = stagePatch(application(), "applied", submitted);
    expect(patch.nextFollowUpAt).toEqual(new Date("2026-10-11T12:00:00Z"));
    const applied = application({ ...patch, stage: "applied" });
    expect(followUpState(applied, now)).toBe("due");
    expect(trackerStats([applied], now).dueFollowUps).toBe(1);
    const sent = { ...applied, followUpSentAt: now };
    expect(followUpState(sent, now)).toBe("sent");
    expect(trackerStats([sent], now).dueFollowUps).toBe(0);
  });
  it("isn't due before day 14", () => {
    const applied = application({ ...stagePatch(application(), "applied", submitted), stage: "applied" });
    expect(followUpState(applied, new Date("2026-10-10T12:00:00Z"))).toBe("upcoming");
  });
});

describe("application state", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  it("records the application date and next follow-up when marked applied", () => {
    const patch = stagePatch(application(), "applied", now);
    expect(patch.appliedAt).toEqual(now);
    expect(patch.nextFollowUpAt).toEqual(new Date("2026-10-07T12:00:00Z"));
  });
  it("clears the reminder after a response and keeps the original application date", () => {
    const appliedAt = new Date("2026-09-10T12:00:00Z");
    const patch = stagePatch(application({ stage: "applied", appliedAt }), "interview", now);
    expect(patch.appliedAt).toBeUndefined();
    expect(patch.nextFollowUpAt).toBeNull();
  });
  it("counts applied roles and due reminders without assuming a rejection was a reply", () => {
    const apps = [
      application({ id: "a", stage: "rejected" }),
      application({ id: "b", stage: "rejected", appliedAt: new Date("2026-09-10T12:00:00Z") }),
      application({ id: "c", stage: "applied", appliedAt: new Date("2026-09-11T12:00:00Z"), nextFollowUpAt: new Date("2026-09-20T12:00:00Z") }),
    ];
    expect(trackerStats(apps, now)).toMatchObject({ applications: 2, dueFollowUps: 1 });
    expect(trackerStats(apps, now)).not.toHaveProperty("responseRate");
  });
  it("drafts a follow-up using only the role, company, and known contact", () => {
    const draft = followUpDraft(application({ contacts: [{ name: "Alex" }] }), "Jordan");
    expect(draft.body).toContain("Hi Alex,");
    expect(draft.body).toContain("Analyst role at Northwind");
    expect(draft.body).not.toMatch(/interview|offer/i);
  });
});

