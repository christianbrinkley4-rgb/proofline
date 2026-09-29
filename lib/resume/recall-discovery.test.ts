import { workWords } from "./recall-work";
import { describe, expect, it } from "vitest";
import { discoverRecall, discoveryTasks, sameRecallWork } from "./recall-discovery";
import { onetTasksForContext, onetTasksForTitle, recallDutyTemplates } from "./onet-tasks";

describe("new work discovery", () => {
  it("excludes already-recorded work across every usable duty, not one person's career", () => {
    const duties = recallDutyTemplates();
    expect(duties.length).toBeGreaterThan(5000);
    for (const duty of duties) {
      const task = { id: "audit", families: [], titleWords: [], template: duty, skills: [], related: [], common: true };
      const experience = { id: "any-person", title: "Any role", kind: "volunteer" };
      expect(discoverRecall(experience, [task], [], [`${duty} weekly using a checklist`]), duty).toEqual([]);
    }
  });

  it("offers different core duties across careers and paid or unpaid experience", () => {
    for (const title of ["Teacher", "Registered Nurse", "Electrician", "Plumber", "Welder", "Dental Hygienist", "Cashier", "Barista", "Waiter", "Receptionist", "Bookkeeper", "Warehouse worker", "Truck driver", "Firefighter", "Chef", "Photographer", "Graphic designer", "Social worker", "Medical assistant", "Construction laborer", "Carpenter", "Library assistant", "Software developer", "Web developer"]) {
      for (const kind of ["work", "volunteer", "leadership", "project"]) {
        const experience = { id: "exp", title, org: "Example organization", kind };
        const tasks = discoveryTasks(experience, []);
        expect(tasks.length, title).toBeGreaterThan(0);
        const first = discoverRecall(experience, tasks, [], [])[0];
        expect(first, title).toBeDefined();
        const known = [`${first.text} weekly using a checklist`];
        const next = discoverRecall(experience, tasks, [], known);
        expect(next.every((card) => !sameRecallWork(card.text, known[0]) && card.sourceFactIds.length === 0), title).toBe(true);
        expect(tasks.every((task) => task.common), title).toBe(true);
      }
    }
  }, 30_000);

  it("matches employment labels to the person's occupation rather than unrelated context", () => {
    for (const title of ["Bookkeeping Assistant (part-time)", "Full-time Registered Nurse", "Contract Software Developer", "Seasonal Cashier", "Freelance Graphic Designer"]) {
      const clean = title.replace(/\b(?:part[ -]time|full[ -]time|contract|seasonal|freelance)\b/gi, " ").replace(/[()]/g, " ");
      const experience = { title, org: "Example organization", kind: "work" };
      const tasks = discoveryTasks(experience, ["Saved the office manager time with a report"]);
      expect(tasks.length, title).toBeGreaterThan(0);
      const expectedCodes = new Set(onetTasksForTitle(clean, 180, true).map((task) => task.id.split(":")[1]));
      expect(tasks.every((task) => expectedCodes.has(task.id.split(":")[1])), title).toBe(true);
    }
  });

  it("treats object-property words as ordinary career text", () => {
    expect(workWords("constructor has ownership of prototype components")).toContain("constructor");
  });

  it("can use specific activity clues outside the named technology projects", () => {
    const garden = onetTasksForContext("Volunteer gardener who planted flowers and operated irrigation equipment");
    expect(garden.length).toBeGreaterThan(0);
    expect(garden.every((task) => task.common)).toBe(true);
    expect(onetTasksForContext("Assistant who likes people and used Excel")).toEqual([]);
  });
  it("recognizes saved work despite changed tense, counts, and common synonyms", () => {
    for (const [cue, saved] of [
      ["Scheduled appointments and kept the calendar up to date", "Booked 50 patient appointments per week using the office calendar"],
      ["Processed payments", "Processed 120 customer payments each week using Stripe"],
      ["Recorded accounting information using accounting software", "Recorded 120 journal entries in QuickBooks for 40 vendor accounts during month-end close"],
      ["Wrote software documentation", "Writing software documentation for 3 internal tools"],
    ]) expect(sameRecallWork(cue, saved), `${cue}: ${saved}`).toBe(true);
    expect(sameRecallWork("Answered incoming calls and took messages", "Scheduled 25 appointments per week using the calendar")).toBe(false);
    expect(sameRecallWork("Resolved customer complaints", "Processed customer payments using Stripe")).toBe(false);
    expect(sameRecallWork("Reviewed vendor accounts", "Reviewed inventory counts using a spreadsheet")).toBe(false);
  });

  it("uses existing work as context and offers different sourced duties", () => {
    const experience = { id: "exp", title: "Receptionist", org: "City Clinic", kind: "work" };
    const known = ["Booked 25 patient appointments per week using the clinic calendar", "Answered incoming calls and took messages"];
    const tasks = discoveryTasks(experience, known);
    const offered = discoverRecall(experience, tasks, [], known);
    expect(offered.length).toBeGreaterThan(2);
    expect(offered.every((card) => card.taskId?.startsWith("onet:") && card.sourceFactIds.length === 0 && card.kind !== "reframe")).toBe(true);
    expect(offered.some((card) => /Scheduled appointments|Answered incoming calls/.test(card.text))).toBe(false);
    expect(offered.every((card) => !known.some((line) => sameRecallWork(card.text, line)))).toBe(true);
  });

  it("retains distinct activities after a rejection and never returns exhausted work as rewrites", () => {
    const experience = { id: "exp", title: "Receptionist", kind: "work" };
    const tasks = onetTasksForTitle(experience.title, 180, true);
    const first = discoverRecall(experience, tasks, [], [])[0];
    const history = [{ text: first.text, taskId: first.taskId, status: "rejected" as const, reason: "not_true" as const }];
    const remaining = discoverRecall(experience, tasks, history, []);
    expect(remaining.length).toBeGreaterThan(0);
    expect(remaining.some((card) => card.taskId === first.taskId || sameRecallWork(card.text, first.text))).toBe(false);
    expect(discoverRecall(experience, tasks, [], tasks.map((task) => task.template))).toEqual([]);
  });

  it("matches actual project work to related occupations without treating tools alone as a role", () => {
    const crm = { title: "Command Center", org: "Custom-built CRM", kind: "project" };
    const tasks = discoveryTasks(crm, ["Built a CRM application using Python to track client follow-ups"]);
    expect(tasks.length).toBeGreaterThan(3);
    expect(tasks.every((task) => task.common && task.id.startsWith("onet:"))).toBe(true);
    const site = discoveryTasks({ title: null, org: "Website Lead Funnel", kind: "project" }, ["Designed a website to collect lead inquiries"]);
    expect(site.length).toBeGreaterThan(2);
    const financial = discoveryTasks({ title: "Financial Statement Analyzer (Python)", org: "Personal project", kind: "project" }, ["Analyzed financial statements and compared company valuations"]);
    expect(financial.length).toBeGreaterThan(2);
    expect(discoveryTasks({ title: "Assistant", org: "Office", kind: "work" }, ["Used Python", "Enjoyed software"]).length).toBe(0);
    expect(discoveryTasks({ title: "Receptionist", org: "Clinic", kind: "work" }, ["Used Python to analyze reports"]).map((task) => task.id)).toEqual(onetTasksForTitle("Receptionist", 180, true, "Clinic Used Python to analyze reports").map((task) => task.id));
  });
});
