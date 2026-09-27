import { describe, expect, it } from "vitest";
import { onetCatalogSize, onetTasksForTitle } from "./onet-tasks";
import { rolePromptIdeas } from "./onet-prompts";

describe("occupational prompt ideas", () => {
  it("has thousands of vetted base questions across many roles", () => {
    const size = onetCatalogSize();
    expect(size.occupations).toBeGreaterThan(1000);
    expect(size.eligible).toBeGreaterThan(7000);
    expect(size.potentialPrompts).toBeGreaterThan(21000);
  });

  it("does not treat a school class as an occupational title", () => {
    expect(onetTasksForTitle("Intro to Business class (BUS 110)")).toEqual([]);
  });

  it("ranks role tasks against a posting and labels every result as a question", () => {
    const ideas = rolePromptIdeas("Bookkeeping assistant", "Reconcile vendor accounts every month and review transaction records. QuickBooks experience required.", 12);
    expect(ideas.length).toBeGreaterThan(4);
    expect(ideas.every((idea) => idea.question.startsWith("Have you done this work?"))).toBe(true);
    expect(ideas.some((idea) => idea.source === "O*NET 31.0")).toBe(true);
    expect(ideas[0].postingMatch).toBeGreaterThanOrEqual(ideas.at(-1)!.postingMatch);
    expect(rolePromptIdeas(null)).toEqual([]);
  });
});
