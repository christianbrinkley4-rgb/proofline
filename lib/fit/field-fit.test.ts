import { describe, expect, it } from "vitest";
import { fieldFit, scoreFit, type CandidateProfile } from "./engine";
import { checkKnockouts, type KnockoutCandidate } from "./knockouts";
import { parseRequirements } from "./requirements";

const accountant: CandidateProfile = {
  confirmedText: ["Reconciled client premium payments each month", "Data Analytics coursework"],
  experienceTitles: ["Licensed Insurance Agent"],
  hasInternship: false,
  major: "Accounting",
  minor: null,
  degree: "Master of Science",
  gpa: 3.69,
  gradDate: "2027-06",
  targetLocations: [],
  workModes: [],
  needsSponsorship: false,
  credentials: [],
};
const job = (title: string, description = "Join our team for the summer. You will learn a lot and work with great people.") => ({
  title, location: "New York, NY", mode: "onsite" as const, level: "internship" as const, requirements: parseRequirements(description),
});

describe("how close a posting with no listed skills is to the person's field", () => {
  it("reads accounting-adjacent work as near and unrelated work as far", () => {
    for (const title of ["Accounting Intern", "Tax Intern", "Business Controller Intern", "Audit Intern", "Investment Analyst Intern"]) expect(fieldFit(title, [], accountant) === "far", title).toBe(false);
    expect(fieldFit("Accounting Intern", ["accounting"], accountant)).toBe("near");
    expect(fieldFit("Social Media Intern", ["marketing"], accountant)).toBe("far");
    expect(fieldFit("Data Science Intern (2027)", ["data"], accountant)).toBe("far");
    expect(fieldFit("Hardware Machine Learning PhD Research Internship", [], accountant)).toBe("far");
    expect(fieldFit("Level Design Intern", [], accountant)).toBe("far");
    expect(fieldFit("Crypto Partnership Intern", [], accountant)).toBe("unknown");
  });

  it("reads engineering work as near for a computer science student", () => {
    expect(fieldFit("Software Engineer Intern", ["software"], { ...accountant, major: "Computer Science", experienceTitles: [] })).toBe("near");
  });

  it("ranks an accounting internship above social media and data science ones when none list skills", () => {
    const score = (title: string) => scoreFit(job(title), accountant).score;
    expect(score("Accounting Intern")).toBeGreaterThan(score("Social Media Intern") + 10);
    expect(score("Accounting Intern")).toBeGreaterThan(score("Data Science Intern (2027)") + 10);
    expect(scoreFit(job("Level Design Intern"), accountant).details.requiredSkills.math).toBe("No listed skills, outside your field: 10 of 30");
  });
});

describe("internships only for PhD or MBA students", () => {
  const candidate: KnockoutCandidate = { gradDate: "2027-06", workAuthorization: "us_citizen", targetLocations: [], workModes: [], openToRelocate: null, availableFrom: null, degree: "Master of Science" };
  const check = (title: string, description = "Help our team.") => checkKnockouts({ ...job(title, description), description }, candidate).find((k) => k.key === "program");

  it("knocks out a PhD internship for a master's student, and says why", () => {
    expect(check("PhD Intern, Data Science (2027)")).toMatchObject({ status: "knockout", reason: "This internship is for PhD students. Your latest degree is a Master of Science." });
    expect(check("Research Intern", "Requirements\n- Currently pursuing a PhD in computer science")?.status).toBe("knockout");
    expect(check("MBA Summer Associate")?.status).toBe("knockout");
  });

  it("adds no row when the posting has no program limit or also takes other students", () => {
    expect(check("Accounting Intern")).toBeUndefined();
    expect(check("Research Intern", "Requirements\n- Pursuing a bachelor's, master's, or PhD degree")).toBeUndefined();
  });

  it("passes a PhD student", () => {
    const phd = checkKnockouts({ ...job("PhD Intern"), description: "" }, { ...candidate, degree: "Doctor of Philosophy" }).find((k) => k.key === "program");
    expect(phd?.status).toBe("ok");
  });
});

describe("a student's major counts as background", () => {
  const withMarketing = { ...accountant, confirmedText: [...accountant.confirmedText, "Developed marketing strategies for new clients", "Excel"] };
  const accountingIntern = job("Accounting Intern", "Requirements\n- Pursuing a degree in accounting\n- Experience with GAAP, NetSuite, and account reconciliation\n- Proficient in Excel");
  const socialIntern = job("Social Media Intern", "Requirements\n- Passion for marketing and social media content");

  it("credits an accounting major's studies on an accounting internship, and not on a marketing one", () => {
    const accounting = scoreFit(accountingIntern, withMarketing);
    const social = scoreFit(socialIntern, withMarketing);
    expect(accounting.details.experience.note).toContain("Your Accounting studies line up with this kind of work.");
    expect(accounting.details.experience.math).toMatch(/^Relevance 12 of 15/);
    expect(social.details.experience.math).toMatch(/^Relevance [0-5] of 15/);
  });

  it("keeps work outside the person's field from earning relevance", () => {
    expect(scoreFit(job("Mechanical Simulation Engineer"), accountant).details.experience.math).toMatch(/^Relevance [0-5] of 15/);
  });
});
