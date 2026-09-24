import { describe, expect, it } from "vitest";
import { answerSupported, draftAnswerOffline, evidenceFor, PLACEHOLDER, questionKind } from "./answers";
import type { Evidence } from "./evidence";

const ev = (id: string, text: string, org: string, experienceId: string, covers: string[] = []): Evidence => ({
  id, kind: "bullet", text, experienceId, org, title: null, factIds: [`f-${id}`], covers, relevance: covers.length, quality: 0.8, recency: 1,
});

const EVIDENCE = [
  ev("b1", "Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments", "Oakwood Family Dental", "e1", ["Account reconciliation"]),
  ev("b2", "Cut month-end inventory counts from 2 days to 6 hours by building an Excel tracker for 300+ SKUs", "NC State Bookstores", "e2", ["Excel"]),
  ev("b3", "Led a 5-person team to 2nd place out of 18 at the regional case competition", "Beta Alpha Psi", "e3"),
];
const FACTS = new Map(EVIDENCE.map((e) => [`f-${e.id}`, e.text]));
const BY_ID = new Map(EVIDENCE.map((e) => [e.id, e]));
const ctx = { company: "Robinhood", role: "Accounting Intern", why: null, evidence: EVIDENCE };

describe("application answers", () => {
  it.each([
    ["Why are you interested in this role?", "motivation"],
    ["Why do you want to join Robinhood?", "motivation"],
    ["What draws you to fintech?", "motivation"],
    ["Describe a time you solved a problem at work.", "behavioral"],
    ["Tell us about a project you're proud of.", "behavioral"],
    ["What experience do you have with Excel?", "skill"],
    ["Anything else we should know?", "general"],
  ])("reads %s as %s", (q, kind) => {
    expect(questionKind(q)).toBe(kind);
  });

  it("matches evidence to the question's words and skills", () => {
    expect(evidenceFor("What experience do you have with Excel?", EVIDENCE)[0].id).toBe("b2");
    expect(evidenceFor("Tell us about a time you led a team", EVIDENCE)[0].id).toBe("b3");
  });

  it("never invents motivation or context", () => {
    const why = draftAnswerOffline("Why are you interested in this role?", ctx);
    expect(PLACEHOLDER.test(why.answer)).toBe(true);
    const mine = draftAnswerOffline("Why are you interested in this role?", { ...ctx, why: "I use Robinhood every week" });
    expect(mine.answer.startsWith("I use Robinhood every week.")).toBe(true);
    const story = draftAnswerOffline("Describe a time you solved a problem at work.", ctx);
    expect(story.answer).toMatch(/^\[Set the scene/);
    expect(story.sourceIds).toHaveLength(1);
  });

  it("answers skill questions from evidence and stays inside a word limit", () => {
    const answer = draftAnswerOffline("What experience do you have with Excel?", ctx, 30);
    expect(answer.answer).toMatch(/^At NC State Bookstores, I cut month-end inventory counts/);
    expect(answer.answer.split(/\s+/).length).toBeLessThanOrEqual(30);
    expect(answerSupported(answer.answer, answer.sourceIds, BY_ID, FACTS)).toBe(true);
  });

  it("rejects a model answer with a number its sources don't contain", () => {
    expect(answerSupported("I reconciled 90 accounts at Oakwood.", ["b1"], BY_ID, FACTS)).toBe(false);
    expect(answerSupported("I led a team of 12.", [], BY_ID, FACTS)).toBe(false);
  });
});
