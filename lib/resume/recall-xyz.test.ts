import { describe, expect, it } from "vitest";
import { composeRecallXyz, recallXyzDefaults } from "./recall-xyz";
import { onetTasksForTitle, recallDutyTemplates } from "./onet-tasks";
import { toPresentTense } from "./polish";
import { isActionVerb } from "./verbs";

describe("fill-in XYZ cards", () => {
  it("shows unknown measures and methods as blanks without adding numbers", () => {
    expect(composeRecallXyz("Processed payments", { measure: "", method: "" }, true)).toBe("Processed payments [count, frequency, or % change] by [how you did it]");
  });
  it("keeps real contributions, methods, and percentage results exactly as supplied", () => {
    expect(composeRecallXyz("Reviewed intake forms", { measure: "30 forms each week", method: "checking missing contact details", result: "20% fewer incomplete records" })).toBe("Reduced incomplete records 20% by reviewing 30 intake forms each week and checking missing contact details");
    expect(composeRecallXyz("Processed payments", { measure: "50 transactions per shift", method: "using Square" })).toBe("Processed 50 payment transactions per shift using Square");
  });
  it("accepts a real frequency without forcing an improvement or percentage", () => {
    expect(composeRecallXyz("Reconciled accounts", { measure: "weekly", method: "comparing bank statements with the ledger" })).toBe("Reconciled accounts weekly by comparing bank statements with the ledger");
  });
  it("rejects blanks, weak or overused openers, and unfinished placeholder claims", () => {
    for (const action of ["Helped with payments", "Drove growth", "Responsible for scheduling"]) expect(() => composeRecallXyz(action, { measure: "weekly", method: "using the calendar" })).toThrow(/clear action/);
    for (const xyz of [{ measure: "", method: "using a calendar" }, { measure: "weekly", method: "[tool]" }, { measure: "weekly", method: "using a calendar", result: "[improvement]" }]) expect(() => composeRecallXyz("Scheduled appointments", xyz)).toThrow(/Fill in/);
  });
  it("prefills only the person's saved details when asking a follow-up", () => {
    expect(recallXyzDefaults("Scheduled appointments (25 each week) using the clinic calendar, resulting in [what changed?]")).toEqual({ action: "Scheduled appointments", measure: "25 each week", method: "using the clinic calendar", result: "" });
    expect(recallXyzDefaults("Scheduled appointments for 3 dentists using [which tool or method?]")).toEqual({ action: "Scheduled appointments for 3 dentists", measure: "", method: "", result: "" });
  });
  it("uses the proposed task method as editable Z without repeating it in X", () => {
    const defaults = recallXyzDefaults("Assisted customers by providing information and resolving complaints");
    expect(defaults.action).toBe("Assisted customers");
    expect(defaults.method).toBe("by providing information and resolving complaints");
    expect(composeRecallXyz(defaults.action, defaults, true)).toBe("Assisted customers [count, frequency, or % change] by providing information and resolving complaints");
  });
  it("avoids institutional language, clipped clauses, and mixed imperative verbs", () => {
    const tasks = ["Cashier", "Bookkeeper", "Software developer", "Warehouse worker"].flatMap((title) => onetTasksForTitle(title, 180, true));
    for (const task of tasks) {
      expect(task.template).not.toMatch(/[,;]$|\bto determine$|establishments|\b(?:and|or) (?:receive|count|unload|open|unpack|issue|advise)\b/i);
    }
    expect(tasks.some((task) => task.template === "Greeted customers as they arrived")).toBe(true);
    expect(tasks.some((task) => task.template === "Recorded accounting information using accounting software")).toBe(true);
  });
  it("turns first-person and present-tense answers into a fluent bullet", () => {
    expect(composeRecallXyz("I schedule patient appointments", { measure: "25 appointments each week", method: "I use the clinic calendar" })).toBe("Scheduled 25 patient appointments each week using the clinic calendar");
  });
  it("turns past-tense method notes and parallel actions into gerunds", () => {
    expect(composeRecallXyz("Reviewed intake forms", { measure: "30 forms each week", method: "I checked missing details and compared records" })).toBe("Reviewed 30 intake forms each week by checking missing details and comparing records");
  });
  it("recognizes tools as nouns instead of saying by a tool", () => {
    for (const method of ["Square", "by Square", "I used Square", "using Square"]) expect(composeRecallXyz("Processed payments", { measure: "50 per shift", method })).toBe("Processed 50 payments per shift using Square");
    expect(composeRecallXyz("Recorded accounting entries", { measure: "daily", method: "accounting software" })).toBe("Recorded accounting entries daily using accounting software");
  });
  it("keeps a different counted unit and every existing denominator attached to the right noun", () => {
    expect(composeRecallXyz("Scheduled appointments for 3 dentists", { measure: "about 25 appointments each week", method: "the clinic calendar" })).toBe("Scheduled about 25 appointments for 3 dentists each week using the clinic calendar");
    expect(composeRecallXyz("Resolved customer complaints", { measure: "15 customers per shift", method: "checking receipts" })).toBe("Resolved customer complaints for 15 customers per shift by checking receipts");
  });
  it("leads with a supplied result and preserves the activity volume and method", () => {
    expect(composeRecallXyz("Reconciled accounts", { measure: "daily", method: "Excel", result: "it saved about 3 hours each week" })).toBe("Saved about 3 hours each week by reconciling accounts daily using Excel");
  });
  it("does not round or strengthen estimates and ranges", () => {
    expect(composeRecallXyz("Reviewed forms", { measure: "at least 20 to 30 forms per week", method: "checking required fields" })).toBe("Reviewed at least 20 to 30 forms per week by checking required fields");
  });
  it("does not attach an unexplained percentage to a task", () => {
    expect(() => composeRecallXyz("Reviewed forms", { measure: "20%", method: "checking required fields" })).toThrow(/percentage measures/);
    expect(composeRecallXyz("Improved accuracy", { measure: "20%", method: "checking required fields" })).toBe("Improved accuracy by 20% through checking required fields");
  });
  it("keeps participation as participation", () => {
    expect(composeRecallXyz("Supported a team", { measure: "5 colleagues", method: "preparing reports" })).toBe("Supported a team of 5 colleagues by preparing reports");
    expect(toPresentTense("Contributed")).toBe("Contribute");
    expect(composeRecallXyz("Contributed reports", { measure: "5 per week", method: "Excel" })).toBe("Contributed 5 reports per week using Excel");
  });
  it("joins supplied currency amounts and named percentage changes naturally", () => {
    expect(composeRecallXyz("Raised funds", { measure: "$1,250", method: "organizing a fundraiser" })).toBe("Raised $1,250 in funds by organizing a fundraiser");
    expect(composeRecallXyz("Reviewed forms", { measure: "20% reduction in errors", method: "checking required fields" })).toBe("Reduced errors 20% by reviewing forms and checking required fields");
    expect(composeRecallXyz("Reviewed forms", { measure: "weekly", method: "a checklist", result: "20% improvement" })).toBe("Reviewed forms weekly using a checklist, resulting in a 20% improvement");
  });
  it("makes singular counts and active first-person notes grammatical", () => {
    expect(composeRecallXyz("Reviewed forms", { measure: "1 form per shift", method: "I was checking required fields" })).toBe("Reviewed 1 form per shift by checking required fields");
    expect(composeRecallXyz("I was scheduling appointments", { measure: "25 each week", method: "I had used the clinic calendar" })).toBe("Scheduled 25 appointments each week using the clinic calendar");
    expect(() => composeRecallXyz("I was trained in scheduling", { measure: "weekly", method: "the calendar" })).toThrow(/clear action/);
  });
  it("preserves both supplied outcomes when the person describes more than one", () => {
    expect(composeRecallXyz("Reviewed forms", { measure: "20% reduction in errors", method: "a checklist", result: "saved 3 hours per week" })).toBe("Saved 3 hours per week by reviewing forms using a checklist and reduced errors by 20%");
  });
  it("supports shorthand frequencies and asks for units instead of inventing them", () => {
    expect(composeRecallXyz("Reviewed forms", { measure: "25 forms/week", method: "a checklist" })).toBe("Reviewed 25 forms per week using a checklist");
    expect(composeRecallXyz("Tracked inventory", { measure: "twice a week", method: "a stock log" })).toBe("Tracked inventory twice a week using a stock log");
    expect(() => composeRecallXyz("Provided information", { measure: "25", method: "a service guide" })).toThrow(/what is counted/);
    expect(() => composeRecallXyz("Reviewed forms", { measure: "weekly", method: "using " + "a long checklist ".repeat(30) })).toThrow(/300 characters/);
  });
  it("recognizes a complete outcome in Y instead of appending it as a counted unit", () => {
    const text = composeRecallXyz("Developed marketing strategies to compete with other agents who sell insurance", { measure: "booked 50 percent more appointments", method: "my automation system I designed" });
    expect(text).toMatch(/^Booked 50 percent more appointments by developing/);
    expect(text).not.toContain("for booked");
    expect(composeRecallXyz("Developed marketing strategies", { measure: "50 percent more appointments", method: "an automation system" })).toBe("Increased appointments 50 percent by developing marketing strategies using an automation system");
    expect(composeRecallXyz("Reviewed forms", { measure: "20 percent fewer incomplete records", method: "a checklist" })).toBe("Reduced incomplete records 20 percent by reviewing forms using a checklist");
  });
  it("audits every usable duty in the full bank with several method and result forms", () => {
    const duties = recallDutyTemplates();
    expect(duties.length).toBeGreaterThan(5000);
    for (const duty of duties) {
      const defaults = recallXyzDefaults(duty);
      for (const method of ["the team checklist", "I checked source records"]) {
        const text = composeRecallXyz(defaults.action, { measure: "weekly", method });
        expect(isActionVerb(text.split(" ")[0]), duty).toBe(true);
        expect(text, duty).not.toMatch(/\[[^\]]+\]|\(weekly\)|by I |by the team checklist|by checked/);
        expect(text, duty).toContain("weekly");
        const result = composeRecallXyz(defaults.action, { measure: "weekly", method, result: "saved about 3 hours each week" });
        expect(result, duty).toContain("3 hours");
        expect(result, duty).not.toMatch(/\[[^\]]+\]|by I /);
      }
    }
  });
  it("starts every recommended line with a strong verb across several occupations", () => {
    for (const title of ["Receptionist", "Cashier", "Bookkeeper", "Electrician", "Software developer", "Teacher", "Registered nurse", "Warehouse worker"]) {
      const tasks = onetTasksForTitle(title, 180, true);
      expect(tasks.length).toBeGreaterThan(0);
      for (const task of tasks) {
        const preview = composeRecallXyz(task.template, { measure: "", method: "" }, true);
        expect(isActionVerb(preview.split(" ")[0])).toBe(true);
        expect(preview).toContain("[count, frequency, or % change]");
        expect(preview).toContain("[how you did it]");
      }
    }
  });
});
