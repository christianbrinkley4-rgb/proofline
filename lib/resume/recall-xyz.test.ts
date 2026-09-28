import { describe, expect, it } from "vitest";
import { composeRecallXyz, recallXyzDefaults } from "./recall-xyz";
import { onetTasksForTitle } from "./onet-tasks";
import { isActionVerb } from "./verbs";

describe("fill-in XYZ cards", () => {
  it("shows unknown measures and methods as blanks without adding numbers", () => {
    expect(composeRecallXyz("Processed payments", { measure: "", method: "" }, true)).toBe("Processed payments ([count, frequency, or % change]) by [how you did it]");
  });
  it("keeps real contributions, methods, and percentage results exactly as supplied", () => {
    expect(composeRecallXyz("Reviewed intake forms", { measure: "30 forms each week", method: "checking missing contact details", result: "20% fewer incomplete records" })).toBe("Reviewed intake forms (30 forms each week) by checking missing contact details, resulting in 20% fewer incomplete records");
    expect(composeRecallXyz("Processed payments", { measure: "50 transactions per shift", method: "using Square" })).toBe("Processed payments (50 transactions per shift) using Square");
  });
  it("accepts a real frequency without forcing an improvement or percentage", () => {
    expect(composeRecallXyz("Reconciled accounts", { measure: "weekly", method: "comparing bank statements with the ledger" })).toBe("Reconciled accounts (weekly) by comparing bank statements with the ledger");
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
    expect(composeRecallXyz(defaults.action, defaults, true)).toBe("Assisted customers ([count, frequency, or % change]) by providing information and resolving complaints");
  });
  it("avoids institutional language, clipped clauses, and mixed imperative verbs", () => {
    const tasks = ["Cashier", "Bookkeeper", "Software developer", "Warehouse worker"].flatMap((title) => onetTasksForTitle(title, 180, true));
    for (const task of tasks) {
      expect(task.template).not.toMatch(/[,;]$|\bto determine$|establishments|\b(?:and|or) (?:receive|count|unload|open|unpack|issue|advise)\b/i);
    }
    expect(tasks.some((task) => task.template === "Greeted customers as they arrived")).toBe(true);
    expect(tasks.some((task) => task.template === "Recorded accounting information using accounting software")).toBe(true);
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
