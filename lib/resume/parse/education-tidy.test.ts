import { describe, expect, it } from "vitest";
import { tidyEducation } from "./education-tidy";
import { parseResumeText } from "./rules";
import type { ParsedEducation } from "./types";

const entry = (patch: Partial<ParsedEducation>): ParsedEducation => ({
  school: "UNC Greensboro", degree: null, major: null, minor: null, gradDate: null, gpa: null, honors: [], coursework: [], details: [], ...patch,
});
const resume = (...education: string[]) =>
  parseResumeText(["Casey Morgan", "casey@example.com", "EDUCATION", ...education, "EXPERIENCE", "Intern | Acme", "June 2025 - Aug 2025", "• Answered 40 calls a day"].join("\n")).education;

describe("one entry per degree", () => {
  it("merges the same school and degree listed twice, keeping every honor and course", () => {
    const result = tidyEducation([
      entry({ degree: "Bachelor of Science", major: "Accounting", gradDate: "2026-12", honors: ["Dean's List"] }),
      entry({ degree: "B.S.", gpa: 3.69, coursework: ["Auditing"], details: ["CPA candidate"] }),
    ]);
    expect(result).toEqual([entry({ degree: "Bachelor of Science", major: "Accounting", gradDate: "2026-12", gpa: 3.69, honors: ["Dean's List"], coursework: ["Auditing"], details: ["CPA candidate"] })]);
  });

  it("keeps two different degrees at one school apart", () => {
    const result = tidyEducation([entry({ degree: "Master of Science", gradDate: "2027-06" }), entry({ degree: "Bachelor of Science", gradDate: "2026-12" })]);
    expect(result.map((e) => e.degree)).toEqual(["Master of Science", "Bachelor of Science"]);
  });

  it("keeps the same degree from two different years apart", () => {
    expect(tidyEducation([entry({ degree: "B.A.", gradDate: "2015-05" }), entry({ degree: "BA", gradDate: "2020-05" })])).toHaveLength(2);
  });

  it("folds a bare school header into the degree under it", () => {
    const result = tidyEducation([entry({ details: ["Transfer student"] }), entry({ degree: "Bachelor of Arts", gradDate: "2026-05" })]);
    expect(result).toEqual([entry({ degree: "Bachelor of Arts", gradDate: "2026-05", details: ["Transfer student"] })]);
  });

  it("names the university, not its business school, as one entry", () => {
    const result = tidyEducation([
      entry({ school: "University of North Carolina at Greensboro" }),
      entry({ school: "Bryan School of Business and Economics", degree: "Bachelor of Science", major: "Accounting", gradDate: "2026-12" }),
    ]);
    expect(result).toEqual([entry({ school: "University of North Carolina at Greensboro", degree: "Bachelor of Science", major: "Accounting", gradDate: "2026-12" })]);
  });
});

describe("education layouts people actually use", () => {
  it("reads two degrees listed under one school heading", () => {
    expect(resume(
      "University of North Carolina at Greensboro",
      "Greensboro, NC",
      "Master of Science in Accounting",
      "Jan 2027 - Jun 2027",
      "Bachelor of Science in Accounting",
      "Expected Dec 2026",
      "GPA: 3.69 | Dean's List",
      "Relevant Coursework: Federal Tax Concepts, Auditing",
    )).toMatchObject([
      { school: "University of North Carolina at Greensboro", degree: "Master of Science", major: "Accounting", gradDate: "2027-06", gpa: null, honors: [] },
      { school: "University of North Carolina at Greensboro", degree: "Bachelor of Science", major: "Accounting", gradDate: "2026-12", gpa: 3.69, honors: ["Dean's List"], coursework: ["Federal Tax Concepts", "Auditing"] },
    ]);
  });

  it("reads a school and degree split by a dash", () => {
    expect(resume(
      "UNC Greensboro — Bachelor of Science, Accounting    Dec 2026",
      "GPA 3.69",
      "UNC Greensboro — Master of Science, Accounting    Jun 2027",
    )).toMatchObject([
      { school: "UNC Greensboro", degree: "Bachelor of Science", major: "Accounting", gradDate: "2026-12", gpa: 3.69 },
      { school: "UNC Greensboro", degree: "Master of Science", major: "Accounting", gradDate: "2027-06" },
    ]);
  });

  it("reads a university and its business school as one degree", () => {
    expect(resume(
      "University of North Carolina at Greensboro, Greensboro, NC",
      "Bryan School of Business and Economics",
      "Bachelor of Science in Accounting, Expected December 2026",
      "Cumulative GPA: 3.69",
    )).toMatchObject([{ school: "University of North Carolina at Greensboro", degree: "Bachelor of Science", major: "Accounting", gradDate: "2026-12", gpa: 3.69 }]);
  });

  it("doesn't start a degree at a line that mentions MS Excel", () => {
    expect(resume("State University", "Bachelor of Science in Biology    May 2026", "MS Excel certified")).toHaveLength(1);
  });
});
