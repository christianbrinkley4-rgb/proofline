import { describe, expect, it } from "vitest";
import { scoreFit, type CandidateProfile } from "./engine";
import { parseGradWindow, parseRequirements } from "./requirements";
import { FIT_COMPONENTS } from "./rubric";

const AUDIT_INTERN = `About the role
Join our audit team for Summer 2027.

What you'll do
• Support audit engagements and document workpapers

Qualifications
• Pursuing a Bachelor's degree in Accounting or Finance
• Minimum cumulative GPA of 3.0
• Graduating between December 2027 and August 2028
• Proficiency in Excel, including pivot tables
• Experience with account reconciliations and journal entries
• Strong communication skills

Preferred
• Experience with Power BI or Tableau
• Beta Alpha Psi or similar involvement

We are unable to sponsor visas for this role.`;

const student: CandidateProfile = {
  confirmedText: [
    "Reconciled 40+ vendor accounts each month in QuickBooks Online",
    "Built an Excel tracker for 300+ SKUs using pivot tables",
    "Prepared 60 federal and state returns as a VITA volunteer",
  ],
  experienceTitles: ["Bookkeeping Assistant", "Inventory Assistant"],
  hasInternship: false,
  major: "Accounting",
  minor: null,
  degree: "Bachelor of Science",
  gpa: 3.6,
  gradDate: "2028-05",
  targetLocations: ["Raleigh, NC"],
  workModes: ["hybrid", "onsite"],
  needsSponsorship: false,
  credentials: [],
};

describe("parseRequirements", () => {
  const req = parseRequirements(AUDIT_INTERN);

  it("splits required from preferred", () => {
    expect(req.required).toEqual(expect.arrayContaining(["Excel", "Account reconciliation", "Journal entries"]));
    expect(req.preferred).toEqual(expect.arrayContaining(["Power BI", "Tableau"]));
    expect(req.required).not.toContain("Power BI");
  });

  it("reads degree fields, GPA, window, and sponsorship", () => {
    expect(req.degreeFields).toEqual(expect.arrayContaining(["accounting", "finance"]));
    expect(req.minGpa).toBe(3.0);
    expect(req.gradWindow).toMatchObject({ from: "2027-12", to: "2028-08" });
    expect(req.noSponsorship).toBe(true);
  });

  it("reads other graduation phrasings", () => {
    expect(parseGradWindow("Open to the Class of 2027")).toMatchObject({ from: "2027-01", to: "2027-12" });
    expect(parseGradWindow("Expected graduation in May 2028")).toMatchObject({ from: "2028-05", to: "2028-05" });
  });
});

describe("scoreFit", () => {
  const job = { title: "Audit Intern, Summer 2027", location: "Raleigh, NC", mode: "hybrid" as const, level: "internship" as const, requirements: parseRequirements(AUDIT_INTERN) };

  it("scores a solid match as a good fit and shows the math", () => {
    const fit = scoreFit(job, student);
    // Missing journal entries and BI tools is real, so this is "good", not "strong".
    expect(fit.score).toBeGreaterThanOrEqual(65);
    expect(fit.cappedBy).toBeNull();
    const total = FIT_COMPONENTS.reduce((sum, c) => sum + fit.points[c.key], 0);
    expect(total).toBe(fit.raw);
    expect(fit.details.requiredSkills.matched).toEqual(expect.arrayContaining(["Excel", "Account reconciliation"]));
    expect(fit.details.preferredSkills.missing).toEqual(["Tableau or Power BI"]);
    expect(fit.details.requiredSkills.missing).toEqual(["Journal entries"]);
    expect(fit.details.location.note).toMatch(/Raleigh area/);
  });

  it("caps the score when the graduation window doesn't fit", () => {
    const fit = scoreFit(job, { ...student, gradDate: "2029-05" });
    expect(fit.score).toBeLessThanOrEqual(40);
    expect(fit.cappedBy?.reason).toMatch(/You graduate 2029-05/);
  });

  it("caps hard when they won't sponsor and the student needs it", () => {
    const fit = scoreFit(job, { ...student, needsSponsorship: true });
    expect(fit.score).toBeLessThanOrEqual(25);
  });

  it("treats \"X or Y\" as one requirement either skill meets", () => {
    const fit = scoreFit(job, { ...student, confirmedText: [...student.confirmedText, "Built dashboards in Tableau"] });
    expect(fit.details.preferredSkills.matched).toEqual(["Tableau"]);
    expect(fit.points.preferredSkills).toBe(15);
  });

  it("doesn't count soft skills against anyone", () => {
    const fit = scoreFit(job, student);
    expect(fit.details.requiredSkills.missing).not.toContain("Communication");
  });
});
