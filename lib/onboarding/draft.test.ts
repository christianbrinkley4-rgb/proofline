import { describe, expect, it } from "vitest";
import { parseResumeText } from "@/lib/resume/parse/rules";
import { draftFromResume } from "./draft";

const B = "";
const RESUME = [
  "Casey Morgan",
  "Durham, NC | 919.555.0101 | casey@example.com",
  "EDUCATION",
  "Master of Science in Accounting, UNC Greensboro | January 2027 to June 2027",
  "Bachelor of Science in Accounting, UNC Greensboro | Expected December 2026 | 3.69 GPA | Dean's List",
  "EXPERIENCE",
  "Financial Advisor Intern | Bankers Life, Greensboro, NC",
  "April 2026 to June 2026",
  `${B} Saved the advisor 5 hours weekly by checking 100+ client files before meetings.`,
  `${B} Booked 10 client meetings through personal outreach calls.`,
  `${B} Researched 3 investment options for 10+ clients weekly.`,
  `${B} Flagged a 15% mid-month revenue dip by tracking the monthly budget.`,
  `${B} Built a one-page summary of client goals before every review.`,
  "Treasurer | UNCG Investment Club",
  "August 2024 to August 2026",
  `${B} Led pitch meetings for 10+ members.`,
  "PROJECTS",
  "Financial Statement Analyzer (Python)",
  `${B} Built a Python tool recalculating key financial ratios.`,
  "SKILLS",
  "Technical: Excel, Python, Tableau",
  "Licenses: NC Life & Health",
].join("\n");

describe("resume into the onboarding form", () => {
  const draft = draftFromResume(parseResumeText(RESUME));

  it("fills the basics from the first school listed and notes the others", () => {
    expect(draft.basics).toEqual({
      contactEmail: "casey@example.com", linkedinUrl: "", portfolioUrl: "",
      fullName: "Casey Morgan", phone: "919.555.0101", city: "Durham", region: "NC",
      school: "UNC Greensboro", degree: "Master of Science", major: "Accounting", gradDate: "2027-06", gpa: "",
    });
    expect(draft.otherEducation).toEqual(["Bachelor of Science in Accounting, UNC Greensboro"]);
  });

  it("turns each role into a form draft, keeping four lines and counting the rest", () => {
    expect(draft.roles.map((r) => [r.kind, r.org, r.title, r.startDate, r.endDate, r.bullets.length, r.extraLines])).toEqual([
      ["internship", "Bankers Life", "Financial Advisor Intern", "2026-04", "2026-06", 4, 1],
      ["leadership", "UNCG Investment Club", "Treasurer", "2024-08", "2026-08", 1, 0],
      ["project", "Financial Statement Analyzer (Python)", "", "", "", 1, 0],
    ]);
  });

  it("carries skills and licenses over for review", () => {
    expect(draft.skills).toEqual(["Excel", "Python", "Tableau"]);
    expect(draft.licenses).toEqual(["NC Life & Health"]);
  });
});
