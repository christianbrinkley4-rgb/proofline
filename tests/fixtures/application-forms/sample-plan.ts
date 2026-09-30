import type { EducationRecord } from "@/lib/facts/base";
import { fillPlan } from "@/lib/extension/kit";
import { buildAnswerKit } from "@/lib/packet/kit";

/**
 * A fill plan for a made-up student, built by the real kit code, for
 * scripts/check-kit-fill.mjs. `npx tsx tests/fixtures/application-forms/sample-plan.ts` prints it.
 */

const school: EducationRecord = {
  id: "e1", school: "UNC Greensboro", degree: "Bachelor of Science", major: "Accounting", gradDate: "Dec 2026", gradMonth: "2026-12",
  gpa: "3.69", honors: "", coursework: "", extras: [],
  factIds: { school: "f-school", degree: "f-degree", major: "f-major", grad: "f-grad", gpa: "f-gpa", honors: [], extras: [] },
};

const facts = new Map([
  ["f-school", "UNC Greensboro"], ["f-degree", "Bachelor of Science"], ["f-major", "Accounting"], ["f-grad", "Dec 2026"], ["f-gpa", "3.69"],
  ["f-org", "Oakwood Family Dental"], ["f-title", "Bookkeeping Assistant"], ["f-dates", "May 2025 to Present"],
  ["f-l1", "Reconciled 40+ vendor accounts each month in QuickBooks Online"],
  ["f-l2", "Built an Excel tracker for 300+ SKUs that cut month-end counts from 2 days to 6 hours"],
  ["f-excel", "Excel"],
]);

export function samplePlan() {
  const kit = buildAnswerKit({
    job: { id: "00000000-0000-4000-8000-00000000c0de", company: "Northwind Tax", title: "Tax Intern", asksCitizenship: false },
    profile: {
      fullName: "Jordan Avery Lee", contactEmail: "jordan.lee@example.com", phone: "(336) 555-0142", city: "Greensboro", region: "NC",
      linkedinUrl: "linkedin.com/in/jordan-lee-example", portfolioUrl: null, workAuthorization: "us_citizen", availableFrom: null, openToRelocate: true,
    },
    education: [school],
    roles: [{
      experienceId: "r1", org: { text: "Oakwood Family Dental", factId: "f-org" }, title: { text: "Bookkeeping Assistant", factId: "f-title" },
      location: null, dates: { start: "2025-05", end: null, factId: "f-dates" },
      lines: [{ text: "Reconciled 40+ vendor accounts each month in QuickBooks Online", factIds: ["f-l1"] }],
    }],
    skills: [{ id: "f-excel", text: "Excel" }],
    licenses: [],
    resume: { id: "res", fileName: "Jordan-Avery-Lee-Northwind-Tax-Resume.pdf", label: "Your resume for this job (Experience first, version 1)" },
    letter: null,
    answers: [{
      id: "a1", question: "What experience do you have with Excel?",
      answer: "At Oakwood Family Dental, I built an Excel tracker for 300+ SKUs that cut month-end counts from 2 days to 6 hours.",
      factIds: ["f-l2"], sourcesChanged: false, ownWords: false,
    }],
    factText: facts,
  });
  return fillPlan(kit, "http://localhost:3000");
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("sample-plan.ts")) console.log(JSON.stringify(samplePlan()));
