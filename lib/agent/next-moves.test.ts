import { describe, expect, it } from "vitest";
import { buildNextMoves, type NextMovesInput } from "./next-moves";

const now = new Date("2026-09-24T15:00:00Z");
const today = "2026-09-24";
const later = "2026-09-28";

const app = (overrides: Partial<NextMovesInput["applications"][number]>): NextMovesInput["applications"][number] => ({
  id: "app-1",
  company: "Acme",
  title: "Analyst",
  stage: "saved",
  deadline: null,
  nextFollowUpAt: null,
  jobId: "job-1",
  resumeId: null,
  ...overrides,
});

const empty: NextMovesInput = {
  factsToReview: 0,
  openQuestions: 0,
  applications: [],
  watched: [],
  prefsPending: 0,
  now,
};

describe("buildNextMoves", () => {
  it("deep-links deadlines and follow-ups to the tracker card", () => {
    const moves = buildNextMoves({
      ...empty,
      applications: [
        app({ id: "d1", company: "Deloitte", stage: "applied", deadline: today }),
        app({ id: "f1", company: "Figma", stage: "applied", nextFollowUpAt: new Date("2026-09-20T12:00:00Z") }),
      ],
    });
    expect(moves.find((m) => m.kind === "deadline")?.href).toBe("/app/tracker?app=d1");
    expect(moves.find((m) => m.kind === "follow_up")?.href).toBe("/app/tracker?app=f1");
  });

  it("splits confirm-facts and answer-questions when both are waiting", () => {
    const moves = buildNextMoves({ ...empty, factsToReview: 3, openQuestions: 2, applications: [app({})] });
    expect(moves.map((m) => m.kind)).toEqual(["confirm_facts", "answer_questions", "resume"]);
    expect(moves.find((m) => m.kind === "confirm_facts")?.detail).toContain("3 facts");
    expect(moves.find((m) => m.kind === "answer_questions")?.detail).toContain("2 questions");
  });

  it("surfaces pending preference suggestions as a prefs move", () => {
    const [move] = buildNextMoves({ ...empty, prefsPending: 2, applications: [app({ stage: "applied", resumeId: "r1" })] });
    expect(move).toMatchObject({ kind: "prefs", href: "/app/jobs" });
    expect(move.title).toContain("2");
  });

  it("ranks by urgency and caps at 6", () => {
    const moves = buildNextMoves({
      ...empty,
      factsToReview: 1,
      openQuestions: 1,
      prefsPending: 1,
      watched: [{ query: "accounting", newJobIds: ["j1"] }],
      applications: [
        app({ id: "dead-today", company: "TodayCo", stage: "applied", deadline: today }),
        app({ id: "dead-week", company: "WeekCo", stage: "saved", deadline: later }),
        app({ id: "follow", company: "FollowCo", stage: "applied", nextFollowUpAt: new Date("2026-09-01T00:00:00Z") }),
        app({ id: "prep", company: "PrepCo", stage: "interview", jobId: "jp" }),
        app({ id: "resume", company: "ResumeCo", stage: "saved", jobId: "jr", resumeId: null }),
      ],
    });
    expect(moves).toHaveLength(6);
    expect(moves.map((m) => m.kind)).toEqual(["deadline", "deadline", "follow_up", "prep", "news", "prefs"]);
    expect(moves[0].title).toContain("today");
    expect(moves[1].title).toContain("this week");
  });

  it("keeps explore when the tracker is empty", () => {
    expect(buildNextMoves(empty)).toEqual([
      expect.objectContaining({ kind: "explore", href: "/app/jobs" }),
    ]);
  });
});
