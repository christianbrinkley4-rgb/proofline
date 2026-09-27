import { describe, expect, it } from "vitest";
import { buildJourney, firstSearch, packetStep, pickFocus, type FocusCandidate, type JourneyInput } from "./coach";

const base: JourneyInput = { confirmedFacts: 0, pendingFacts: 0, usableBullets: 0, experiences: 0, baseResume: false, focus: null };
const ready: JourneyInput = { ...base, confirmedFacts: 6, usableBullets: 2, experiences: 2, baseResume: true };
const job = (over: Partial<FocusCandidate> = {}): FocusCandidate => ({
  jobId: "job-1",
  company: "Carrow Partners",
  title: "Business Intern",
  stage: null,
  resumes: 0,
  letter: "none",
  openGaps: 0,
  stale: false,
  updatedAt: new Date("2026-09-20"),
  ...over,
});

describe("buildJourney", () => {
  it("starts a brand-new student on their story, one action, four steps", () => {
    const j = buildJourney(base);
    expect(j.current).toBe("resume");
    expect(j.steps.map((s) => s.label)).toEqual(["Your resume", "Paste a job", "3 resumes", "Close gaps"]);
    expect(j.action.href).toBe("/app/profile#start");
  });

  it("asks to confirm imported facts before anything else", () => {
    const j = buildJourney({ ...base, pendingFacts: 7 });
    expect(j.action).toMatchObject({ title: "Check what I found about you", href: "/app/profile" });
    expect(j.action.detail).toContain("7 facts");
  });

  it("asks for a usable bullet before sending someone to build a resume", () => {
    const journey = buildJourney({ ...ready, baseResume: false, usableBullets: 0 });
    expect(journey.current).toBe("resume");
    expect(journey.action).toMatchObject({
      title: "Turn an example into a resume bullet", href: "/app/profile",
    });
  });
  it("builds a general resume once there's evidence, then asks for a job", () => {
    expect(buildJourney({ ...ready, baseResume: false }).action).toMatchObject({ title: "Build your resume", href: "/app/resumes/new" });
    const paste = buildJourney(ready);
    expect(paste.current).toBe("job");
    expect(paste.action.href).toBe("/app#paste");
  });

  it("walks a pasted job through three resumes, then its gaps, then a rebuild", () => {
    expect(buildJourney({ ...ready, focus: job() }).action.href).toBe("/app/jobs/job-1?build=1#resumes");
    const gaps = buildJourney({ ...ready, focus: job({ resumes: 3, openGaps: 2 }) });
    expect(gaps.current).toBe("strengthen");
    expect(gaps.action.detail).toContain("2 things the posting asks for");
    expect(buildJourney({ ...ready, focus: job({ resumes: 3, stale: true }) }).action.title).toBe("Rebuild with what you just added");
    const done = buildJourney({ ...ready, focus: job({ resumes: 3 }) });
    expect(done.current).toBe("done");
    expect(done.steps.every((s) => s.state === "done")).toBe(true);
    expect(done.action.href).toBe("/app#paste");
  });
});

describe("pickFocus", () => {
  it("works on the newest unsent job, so a fresh paste becomes the focus", () => {
    const focus = pickFocus([
      job({ jobId: "old", resumes: 3, updatedAt: new Date("2026-09-10") }),
      job({ jobId: "pasted", updatedAt: new Date("2026-09-23") }),
      job({ jobId: "sent", stage: "applied", updatedAt: new Date("2026-09-24") }),
    ]);
    expect(focus?.jobId).toBe("pasted");
  });

  it("falls back to the newest sent job, never a rejection", () => {
    expect(pickFocus([job({ jobId: "r", stage: "rejected" }), job({ jobId: "a", stage: "applied" })])?.jobId).toBe("a");
    expect(pickFocus([])).toBeNull();
  });
});

describe("packetStep", () => {
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

describe("skipping the general resume", () => {
  it("doesn't send someone who already pasted a job back to build a general resume", () => {
    const j = buildJourney({ ...ready, baseResume: false, focus: job() });
    expect(j.current).toBe("tailor");
  });
});
