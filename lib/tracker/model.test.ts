import { describe, expect, it } from "vitest";
import { followUpDraft, stagePatch, trackerStats, type Application } from "./model";

const application = (overrides: Partial<Application> = {}): Application => ({
  id: "1", userId: "u", jobId: null, company: "Northwind", title: "Analyst", url: null,
  stage: "saved", resumeId: null, appliedAt: null, stageChangedAt: new Date("2026-09-01T00:00:00Z"),
  nextFollowUpAt: null, deadline: null, notes: null, contacts: null, sortOrder: 0,
  createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z"),
  ...overrides,
});
describe("application state", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  it("records the application date and next follow-up when marked applied", () => {
    const patch = stagePatch(application(), "applied", now);
    expect(patch.appliedAt).toEqual(now);
    expect(patch.nextFollowUpAt).toEqual(new Date("2026-09-30T12:00:00Z"));
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

