import { describe, expect, it } from "vitest";
import { scoreFit, type CandidateProfile } from "./engine";
import { parseGradWindow, parseRequirements } from "./requirements";
import { FIT_COMPONENTS } from "./rubric";
import { extractSkills } from "./skills";

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

  it("does not treat a preferred degree as a requirement", () => {
    const req = parseRequirements("Qualifications\nCustomer service experience required\nPreferred\nBachelor's degree in accounting");
    expect(req.degreeFields).toEqual([]);
    expect(parseRequirements("Qualifications\nCustomer service experience required\nBachelor's degree in accounting preferred").degreeFields).toEqual([]);
  });

  it("separates inline required and preferred clauses in a pasted posting", () => {
    const req = parseRequirements("Medical Receptionist\nWillow Family Health\nReview patient intake forms. Required: clear communication and experience with scheduling software. Preferred: electronic health records, insurance verification, and bilingual Spanish.");
    expect(req.required).toContain("Scheduling software");
    expect(req.required).not.toContain("Electronic health records");
    expect(req.required).not.toContain("Spanish");
    expect(req.preferred).toEqual(expect.arrayContaining(["Electronic health records", "Insurance verification", "Spanish"]));
    expect(req.mentioned).toContain("Patient intake");
    expect(req.mentioned).not.toContain("Patient care");
    const fit = scoreFit({ title: "Medical Receptionist", location: null, mode: "onsite", level: "entry", requirements: req }, {
      ...student, confirmedText: ["Checked intake forms for missing information"], experienceTitles: ["Receptionist"],
    });
    expect(fit.details.requiredSkills.missing).toContain("Scheduling software");
    expect(fit.details.requiredSkills.missing).not.toContain("Spanish");
    expect(fit.details.preferredSkills.missing).toContain("Spanish");
  });
  it("does not repeat a required skill as a preferred gap", () => {
    const req = parseRequirements("Required: Marketing campaign experience\nPreferred: Marketing (nice to have)");
    expect(req.required).toContain("Marketing");
    expect(req.preferred).not.toContain("Marketing");
    expect(req.preferredGroups.flat()).not.toContain("Marketing");
  });

  it("keeps separate requirements on a mixed comma and alternative line", () => {
    const req = parseRequirements("Required: Medidata Rave, CDISC SDTM/CDASH, oncology trials, people management");
    expect(req.requiredGroups).toEqual(expect.arrayContaining([
      ["Medidata Rave"], ["CDISC"], ["SDTM"], ["CDASH"], ["Oncology"], ["People management"],
    ]));
  });

  it("recognizes clinical data and everyday cashier work", () => {
    expect(extractSkills("Managed oncology clinical data in Medidata Rave using CDISC SDTM and CDASH; supervised analysts")).toEqual(
      expect.arrayContaining(["Clinical data management", "Medidata Rave", "CDISC", "SDTM", "CDASH", "Oncology", "People management"]),
    );
    expect(extractSkills("Ran the register and helped customers find items")).toEqual(
      expect.arrayContaining(["Point-of-sale systems", "Customer service"]),
    );
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

  it("credits a documented clinical specialist and a cashier for their actual work", () => {
    const clinicalReq = parseRequirements("Senior Clinical Data Manager\nQualifications\n12 years of clinical data management. Medidata Rave, CDISC SDTM/CDASH, oncology trials, and people management required.\nPreferred\nBudgeting and forecasting.");
    const clinical = scoreFit({
      title: "Senior Clinical Data Manager", location: null, mode: "unknown", level: "experienced", requirements: clinicalReq,
    }, {
      ...student,
      confirmedText: ["Managed oncology clinical data in Medidata Rave using CDISC SDTM and CDASH and supervised analysts for 12 years"],
      experienceTitles: ["Clinical Data Manager"],
      documentedYearsExperience: 12,
      degree: null, major: null, gradDate: null,
    });
    expect(clinical.details.requiredSkills.missing).toEqual([]);
    expect(clinical.score).toBeGreaterThanOrEqual(65);

    const retailReq = parseRequirements("Retail Cashier\nQualifications\nPoint-of-sale systems and customer service required.");
    const retail = scoreFit({
      title: "Retail Cashier", location: null, mode: "unknown", level: "entry", requirements: retailReq,
    }, {
      ...student,
      confirmedText: ["Ran the register and helped customers find items"],
      experienceTitles: ["Cashier"],
      degree: null, major: null, gradDate: null,
    });
    expect(retail.details.requiredSkills.missing).toEqual([]);
    expect(retail.score).toBeGreaterThanOrEqual(60);
  });

  it("matches a restaurant manager's confirmed duties to a prose posting", () => {
    const posting = "Restaurant General Manager\nWillow & Pine Hospitality\nDurham, NC\nWe are hiring a restaurant general manager to lead daily service at a busy full-service restaurant. You will schedule and coach a team of 10–20 employees, track daily sales, balance receipts, resolve guest concerns, manage inventory and vendor orders, and maintain food safety standards. The ideal candidate has 3+ years of restaurant management experience, can explain their work with labor budgets and cost control, and is comfortable with point-of-sale systems. ServSafe certification is preferred.";
    const req = parseRequirements(posting);
    expect(req.yearsExperience).toBe(3);
    expect(req.required).toEqual(expect.arrayContaining(["Staff scheduling", "Sales", "Cash handling", "Customer service", "Inventory management", "Food safety", "Point-of-sale systems"]));
    expect(req.preferred).toContain("ServSafe");
    expect(req.preferred).not.toContain("Staff scheduling");
    const fit = scoreFit({
      title: "Restaurant General Manager", location: "Durham, NC", mode: "onsite", level: "experienced", requirements: req,
    }, {
      ...student,
      confirmedText: ["Scheduled 12 employees across weekly shifts and tracked daily sales", "Balanced daily receipts and resolved customer questions during busy service"],
      experienceTitles: ["General Manager", "Bull City Bistro"],
      documentedYearsExperience: 7,
      degree: "Associate in Applied Science", major: "Hospitality Management", gradDate: "2016",
    });
    expect(fit.strengths).toContain("Staff scheduling, which they ask for");
    expect(fit.details.requiredSkills.matched).toEqual(expect.arrayContaining(["Staff scheduling", "Sales", "Cash handling", "Customer service"]));
    expect(fit.details.requiredSkills.missing).toEqual(expect.arrayContaining(["Inventory management", "Food safety", "Point-of-sale systems"]));
    expect(fit.details.experience.matched).toContain("General Manager");
  });

  it("does not credit skills mentioned only as missing experience", () => {
    const role = { ...job, requirements: parseRequirements("Qualifications\nExcel and SQL required") };
    const noExperience = scoreFit(role, {
      ...student,
      confirmedText: ["No experience with Excel; I have never used SQL", "Built dashboards in Tableau"],
      experienceTitles: [],
    });
    expect(noExperience.details.requiredSkills.missing).toEqual(expect.arrayContaining(["Excel", "SQL"]));
    const coordinatedDenial = scoreFit(role, {
      ...student,
      confirmedText: ["I have no experience with Excel or SQL"],
      experienceTitles: [],
    });
    expect(coordinatedDenial.details.requiredSkills.missing).toEqual(expect.arrayContaining(["Excel", "SQL"]));
    const laterEvidence = scoreFit(role, {
      ...student,
      confirmedText: ["No experience with Excel before school. Later used Excel to track invoices", "I have not used SQL"],
      experienceTitles: [],
    });
    expect(laterEvidence.details.requiredSkills.matched).toContain("Excel");
    expect(laterEvidence.details.requiredSkills.missing).toContain("SQL");
  });

  it("keeps Google Sheets distinct from an Excel-only requirement", () => {
    expect(extractSkills("Built a budget in Google Sheets")).toContain("Google Sheets");
    expect(extractSkills("Built a budget in Google Sheets")).not.toContain("Excel");
    const excelOnly = { ...job, requirements: parseRequirements("Qualifications\nExcel required") };
    const fit = scoreFit(excelOnly, { ...student, confirmedText: ["Built a budget in Google Sheets"] });
    expect(fit.details.requiredSkills.missing).toContain("Excel");
  });

  it("records a graduation-window problem without blending it into the score", () => {
    const eligible = scoreFit(job, student);
    const fit = scoreFit(job, { ...student, gradDate: "2029-05" });
    expect(fit.cappedBy).toBeNull();
    expect(fit.score).toBe(fit.raw);
    expect(fit.gates[0]?.reason).toMatch(/You graduate 2029-05/);
    expect(fit.points.requiredSkills).toBe(eligible.points.requiredSkills);
  });

  it("records a sponsorship problem without capping the score", () => {
    const fit = scoreFit(job, { ...student, needsSponsorship: true });
    expect(fit.cappedBy).toBeNull();
    expect(fit.gates.some((g) => /sponsor/.test(g.reason))).toBe(true);
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

  it("does not penalize a person for skipping college when the job does not require it", () => {
    const role = { title: "Customer Service Representative", location: "Raleigh, NC", mode: "onsite" as const, level: "entry" as const, requirements: parseRequirements("Help customers and resolve issues.") };
    const withoutCollege = { ...student, degree: null, major: null, minor: null, gpa: null, gradDate: null, experienceTitles: ["Customer Service Associate"] };
    expect(scoreFit(role, withoutCollege).points.education).toBe(scoreFit(role, student).points.education);
    expect(scoreFit(role, withoutCollege).details.education.missing).toEqual([]);
  });

  it("credits documented work and does not cap every experienced role", () => {
    const role = { title: "Senior Customer Service Representative", location: "Raleigh, NC", mode: "onsite" as const, level: "experienced" as const, requirements: { ...parseRequirements("Qualifications\n3 years of experience"), yearsExperience: 3 } };
    const experienced = { ...student, degree: null, major: null, experienceTitles: ["Customer Service Lead"], documentedYearsExperience: 6 };
    const newToWork = { ...experienced, documentedYearsExperience: 0 };
    expect(scoreFit(role, experienced).points.experience).toBeGreaterThan(scoreFit(role, newToWork).points.experience);
    expect(scoreFit(role, experienced).cappedBy).toBeNull();
    expect(scoreFit(role, experienced).details.experience.missing).toEqual([]);
    expect(scoreFit(role, newToWork).nextSteps).toContainEqual(expect.stringMatching(/Add dates/));
  });

  it("suggests a different eligible search when a hard requirement is outside the person's profile", () => {
    const fit = scoreFit(job, { ...student, gradDate: "2029-05", needsSponsorship: true });
    expect(fit.nextSteps).toContainEqual(expect.stringMatching(/graduation year/));
    expect(fit.nextSteps).toContainEqual(expect.stringMatching(/work authorization/));
  });

  it("recognizes concrete service and trade skills in a non-college profile", () => {
    expect(extractSkills("Handled cash registers, counted inventory, and operated forklifts")).toEqual(
      expect.arrayContaining(["Point-of-sale systems", "Forklift operation"]),
    );
    const role = { title: "Warehouse Associate", location: null, mode: "onsite" as const, level: "entry" as const, requirements: parseRequirements("Qualifications\nForklift operation required\nInventory management required") };
    const worker = { ...student, degree: null, major: null, confirmedText: ["Operated forklifts and managed inventory control"], experienceTitles: ["Warehouse Associate"] };
    const fit = scoreFit(role, worker);
    expect(fit.details.requiredSkills.matched).toEqual(expect.arrayContaining(["Forklift operation", "Inventory management"]));
    expect(fit.details.education.missing).toEqual([]);
  });
});
