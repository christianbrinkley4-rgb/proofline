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

describe("matching a role title to common work", () => {
  const lines = (title: string) => rolePromptIdeas(title, null, 12).map((idea) => idea.template).join("\n");

  it("never offers penetration testing, bookkeeping, or inspection lines to a QA role", () => {
    for (const title of ["QA Intern", "QA Tester", "QA Tester Intern", "Quality Assurance Intern", "Quality Assurance Tester", "Software QA Analyst Intern", "QA Analyst Intern"]) {
      const text = lines(title);
      expect(text, title).not.toMatch(/penetration|security system|invoices|transaction records|finished products|training/i);
    }
  });

  it("offers testing lines to a QA role, and software test lines only when it is software", () => {
    expect(lines("QA Intern")).toMatch(/Retested fixes/);
    expect(lines("QA Intern")).not.toMatch(/Wrote tests for the project/);
    expect(lines("Software QA Intern")).toMatch(/Wrote tests for the project/);
    expect(lines("Software QA Intern")).not.toMatch(/Built a working feature/);
  });

  it("keeps penetration testing lines for a penetration tester", () => {
    expect(lines("Penetration Tester")).toMatch(/penetration test/i);
    expect(lines("Penetration Tester")).not.toMatch(/Checked work against written requirements/);
  });

  it("offers nothing from the occupation list when a bare title fits unrelated fields equally", () => {
    for (const title of ["Tester", "Manager", "Specialist", "Delivery Driver"]) {
      expect(onetTasksForTitle(title), title).toEqual([]);
      expect(onetTasksForTitle(title, 180, true), title).toEqual([]);
    }
  });

  it("matches QA titles to software testing, the occupation whose official title names them", () => {
    for (const title of ["QA Intern", "QA Tester", "Quality Assurance Intern", "Software QA Intern", "Software Testing Intern"]) {
      const codes = new Set(onetTasksForTitle(title).map((task) => task.id.split(":")[1]));
      expect([...codes], title).toEqual(["15-1253.00"]);
    }
  });

  it("prefers the occupation named by the title over occupations that only list it as an alias", () => {
    expect(new Set(onetTasksForTitle("Cashier").map((task) => task.id.split(":")[1]))).toEqual(new Set(["41-2011.00"]));
    expect(new Set(onetTasksForTitle("Seasonal Cashier").map((task) => task.id.split(":")[1]))).toEqual(new Set(["41-2011.00"]));
    expect(onetTasksForTitle("Truck driver").every((task) => task.id.startsWith("onet:53-"))).toBe(true);
  });

  it("still matches clear titles", () => {
    expect(onetTasksForTitle("Cashier").length).toBeGreaterThan(2);
    expect(lines("Accounting Intern")).toMatch(/invoices/);
  });
});
