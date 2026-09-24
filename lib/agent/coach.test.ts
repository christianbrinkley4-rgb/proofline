import { describe, expect, it } from "vitest";
import { buildJourney, firstSearch, jobPlan, packetStep, pickFocus, type FocusCandidate, type JourneyInput } from "./coach";

const base: JourneyInput = { confirmedFacts: 0, pendingFacts: 0, experiences: 0, searched: false, suggestedQuery: null, focus: null };
const job = (over: Partial<FocusCandidate> = {}): FocusCandidate => ({
  jobId: "job-1",
  company: "Carrow Partners",
  title: "Business Intern",
  stage: null,
  resumes: 0,
  letter: "none",
  updatedAt: new Date("2026-09-20"),
  ...over,
});

describe("buildJourney", () => {
  it("starts a brand-new student on their story, with one action", () => {
    const j = buildJourney(base);
    expect(j.current).toBe("story");
    expect(j.position).toBe(1);
    expect(j.steps.map((s) => s.state)).toEqual(["current", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(j.action.href).toBe("/app/profile#start");
  });

  it("asks to confirm imported facts before anything else", () => {
    const j = buildJourney({ ...base, pendingFacts: 7 });
    expect(j.action).toMatchObject({ title: "Check what I found about you", href: "/app/profile" });
    expect(j.action.detail).toContain("7 facts");
  });

  it("moves to a first search built from goals once there is evidence", () => {
    const j = buildJourney({ ...base, confirmedFacts: 4, experiences: 1, suggestedQuery: "business internships in Raleigh" });
    expect(j.current).toBe("find");
    expect(j.action.href).toBe("/app/jobs?q=business%20internships%20in%20Raleigh");
  });

  it("walks one job through resume, packet, and track in order", () => {
    const ready = { ...base, confirmedFacts: 5, experiences: 2, searched: true };
    expect(buildJourney({ ...ready }).current).toBe("fit");
    expect(buildJourney({ ...ready, focus: job() }).action.href).toBe("/app/resumes/compare?job=job-1");
    expect(buildJourney({ ...ready, focus: job({ resumes: 1 }) }).action.title).toBe("Draft your cover letter for Carrow Partners");
    expect(buildJourney({ ...ready, focus: job({ resumes: 1, letter: "needs_you" }) }).action.title).toBe("Say why you want Carrow Partners");
    const track = buildJourney({ ...ready, focus: job({ resumes: 1, letter: "ready", stage: "saved" }) });
    expect(track.current).toBe("track");
    expect(track.position).toBe(6);
    const done = buildJourney({ ...ready, focus: job({ resumes: 1, letter: "ready", stage: "applied" }) });
    expect(done.current).toBe("done");
    expect(done.steps.every((s) => s.state === "done")).toBe(true);
  });

  it("keeps the story step current when a job is saved but there is no evidence", () => {
    expect(buildJourney({ ...base, searched: true, focus: job({ resumes: 1 }) }).current).toBe("story");
  });
});

describe("pickFocus", () => {
  it("prefers the unsent job furthest along, then the newest", () => {
    const focus = pickFocus([
      job({ jobId: "new", updatedAt: new Date("2026-09-23") }),
      job({ jobId: "far", resumes: 2, updatedAt: new Date("2026-09-10") }),
      job({ jobId: "sent", stage: "applied", resumes: 1, letter: "ready", updatedAt: new Date("2026-09-24") }),
    ]);
    expect(focus?.jobId).toBe("far");
  });

  it("falls back to the newest sent job, never a rejection", () => {
    expect(pickFocus([job({ jobId: "r", stage: "rejected" }), job({ jobId: "a", stage: "applied" })])?.jobId).toBe("a");
    expect(pickFocus([])).toBeNull();
  });
});

describe("jobPlan and packetStep", () => {
  it("puts one primary action first, in loop order", () => {
    const plan = (over: Partial<Parameters<typeof jobPlan>[0]>) => jobPlan({ resumes: 0, letter: "none", stage: null, capped: false, storyReady: true, ...over }).primary;
    expect(plan({ storyReady: false })).toBe("story");
    expect(plan({})).toBe("resume");
    expect(plan({ resumes: 1 })).toBe("packet");
    expect(plan({ resumes: 1, letter: "ready" })).toBe("apply");
    expect(plan({ stage: "interview" })).toBe("prep");
    expect(plan({ capped: true })).toBe("packet");
  });

  it("orders the packet: resume, then letter, then track", () => {
    expect(packetStep({ resumes: 0, attached: false, letter: "none", stage: null })).toBe("resume");
    expect(packetStep({ resumes: 2, attached: false, letter: "needs_you", stage: null })).toBe("letter");
    expect(packetStep({ resumes: 2, attached: true, letter: "ready", stage: "saved" })).toBe("track");
    expect(packetStep({ resumes: 2, attached: true, letter: "ready", stage: "applied" })).toBe("done");
  });
});

describe("firstSearch", () => {
  it("builds a query from goals and skips a bare Remote place", () => {
    expect(firstSearch({ targetRoles: ["Business intern"], targetLocations: ["Remote", "Raleigh, NC"], targetTerm: "Summer 2027" })).toBe(
      "Business intern in Raleigh, NC for Summer 2027",
    );
    expect(firstSearch({ targetRoles: [] })).toBeNull();
  });
});
