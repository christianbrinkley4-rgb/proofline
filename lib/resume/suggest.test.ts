import { describe, expect, it } from "vitest";
import { ROLE_TASKS, taskSkillsAreKnown, tasksForExperience, titleTermMatches } from "./role-tasks";
import { onetCatalogSize, onetFollowupsForAccepted, onetTasksForTitle } from "./onet-tasks";
import { candidates, nearDuplicate, rankSuggestions, validSuggestion } from "./suggest";

describe("role task coverage", () => {
  it("covers the student roles in the handoff with known skill tags", () => {
    expect(taskSkillsAreKnown()).toBe(true);
    for (const title of ["Bookkeeping assistant", "Receptionist", "Cashier", "Barista", "Tutor", "Call center representative", "Warehouse associate", "Club treasurer", "Research assistant", "Social media intern", "Data analyst intern", "Software project"]) {
      expect(tasksForExperience({ title, kind: "work" }).length, title).toBeGreaterThan(0);
    }
  });

  it("does not turn assistant into a teaching assistant or app into an apprentice", () => {
    expect(titleTermMatches("bookkeeping assistant", "ta")).toBe(false);
    expect(titleTermMatches("bookkeeping assistant", "bookkeep")).toBe(true);
    expect(tasksForExperience({ title: "Bookkeeping assistant", kind: "work" }).map((task) => task.id)).not.toContain("teach.lesson");
    expect(tasksForExperience({ title: "App developer", kind: "project" }).map((task) => task.id)).not.toContain("trade.plan");
  });

  it("has thousands of occupation tasks and matches titles outside the curated list", () => {
    expect(onetCatalogSize().tasks).toBeGreaterThan(18_000);
    expect(onetCatalogSize().eligible).toBeGreaterThan(1_000);
    expect(onetCatalogSize().potentialPrompts).toBeGreaterThan(3_000);
    expect(onetTasksForTitle("Dental Hygienist").length).toBeGreaterThan(2);
    expect(onetTasksForTitle("Electrician").length).toBeGreaterThan(2);
    expect(onetTasksForTitle("Bookkeeping assistant").some((task) => /academic or administrative committees/i.test(task.template))).toBe(false);
    expect(onetTasksForTitle("Museum technician").length).toBeGreaterThan(0);
    expect(onetTasksForTitle("Bookkeeping assistant").some((task) => /Reconciled or note and report/i.test(task.template))).toBe(false);
  });

  it("offers result and method angles only after a base task is confirmed", () => {
    const base = onetTasksForTitle("Electrician");
    const selected = base.find((item) => item.template.length < 140 && !/\b(using|through|with| by )\b/i.test(item.template));
    expect(selected).toBeDefined();
    expect(onetFollowupsForAccepted(base, new Set())).toEqual([]);
    const followups = onetFollowupsForAccepted(base, new Set([selected!.id]));
    expect(followups.some((item) => item.id.endsWith(":method") && item.slot === "which tool or method?")).toBe(true);
  });
});

describe("suggestion generation", () => {
  const exp = { id: "exp", title: "Bookkeeping assistant", kind: "work", targetRoles: ["Accounting"] };
  const facts = [{ id: "fact", category: "experience" as const, content: "I reconciled 40 vendor accounts each month" }];

  it("makes questions from stated facts and possible tasks without invented digits", () => {
    const out = candidates(exp, facts, tasksForExperience(exp));
    expect(out.some((item) => item.kind === "reframe" && item.sourceFactIds.includes("fact") && item.text.includes("40"))).toBe(true);
    expect(out.some((item) => item.slot && item.text.includes(`[${item.slot}]`))).toBe(true);
    expect(out.every(validSuggestion)).toBe(true);
  });

  it("suppresses an untrue task and its relatives for the experience", () => {
    const out = candidates(exp, [], tasksForExperience(exp));
    const ranked = rankSuggestions(out, [{ text: "Reconciled accounts", taskId: "books.reconcile", status: "rejected", reason: "not_true" }], ROLE_TASKS);
    expect(ranked.some((item) => item.taskId === "books.reconcile" || item.taskId === "books.payables")).toBe(false);
    const crossSource = { text: "Checked bank records against ledger entries", taskId: "onet:43-3031.00:999", kind: "likely_task" as const, skills: ["Account reconciliation"], sourceFactIds: [], slot: null };
    expect(rankSuggestions([crossSource], [{ text: "Reconciled accounts", taskId: "books.reconcile", status: "rejected", reason: "not_true" }], ROLE_TASKS)).toEqual([]);
  });

  it("boosts related accepted tasks and favors a measure after a weak answer", () => {
    const out = candidates(exp, [], tasksForExperience(exp));
    const ranked = rankSuggestions(out, [
      { text: "Processed invoices", taskId: "books.payables", status: "accepted" },
      { text: "Maintained records", taskId: null, status: "rejected", reason: "true_but_weak" },
    ], ROLE_TASKS);
    expect(ranked[0].taskId).toBe("books.reconcile");
  });

  it("drops repeated wording from both earlier cards and existing bullets", () => {
    expect(nearDuplicate("Processed vendor invoices and tracked payments", "Tracked payments and processed vendor invoices")).toBe(true);
    expect(nearDuplicate("Answered patient calls and scheduled about 25 appointments each week using the clinic calendar", "Scheduled appointments and updated the office calendar")).toBe(true);
    expect(nearDuplicate("Answered patient calls and scheduled about 25 appointments each week using the clinic calendar", "Checked intake forms and routed questions to nurses")).toBe(false);
    const out = candidates(exp, [], tasksForExperience(exp));
    const ranked = rankSuggestions(out, [], ROLE_TASKS, ["Processed vendor invoices and tracked payments"]);
    expect(ranked.some((item) => item.taskId === "books.payables")).toBe(false);
  });
});
