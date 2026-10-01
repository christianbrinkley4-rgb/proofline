import { describe, expect, it } from "vitest";
import { findDateRange, formatRange, normalizeDate } from "./dates";
import { parseResumeText, trailingPlace } from "./rules";

const SAMPLE = `Taylor Morgan
Raleigh, NC | taylor.morgan@example.com | (919) 555-0188 | linkedin.com/in/taylor-morgan-example

EDUCATION
North Carolina State University, Raleigh, NC                  Expected May 2028
Bachelor of Science in Accounting, Minor in Business Analytics    GPA: 3.62/4.0
Relevant Coursework: Intermediate Accounting I, Federal Income Tax, Cost Accounting
Dean's List, Fall 2024 and Spring 2025

EXPERIENCE
Oakwood Family Dental | Raleigh, NC
Bookkeeping Assistant (part-time)                              May 2025 – Present
• Reconciled 40+ vendor accounts each month in QuickBooks Online
• Built a weekly cash report from bank and QuickBooks data, saving the office
  manager about 3 hours a week
NC State Bookstores | Raleigh, NC
Inventory Assistant                                             Aug 2024 – May 2025
• Counted and tracked 300+ SKUs at month-end

LEADERSHIP
Beta Alpha Psi | Member                                          Sep 2024 – Present
• Led a 5-person team to 2nd place of 18 at the regional case competition

SKILLS
Technical: Excel (pivot tables, XLOOKUP), QuickBooks Online, SQL
Languages: Spanish (conversational)
`;

describe("parseResumeText", () => {
  const parsed = parseResumeText(SAMPLE);

  it("reads the header", () => {
    expect(parsed.name).toBe("Taylor Morgan");
    expect(parsed.email).toBe("taylor.morgan@example.com");
    expect(parsed.phone).toBe("(919) 555-0188");
    expect(parsed.location).toBe("Raleigh, NC");
    expect(parsed.links).toContain("linkedin.com/in/taylor-morgan-example");
  });

  it("reads education", () => {
    expect(parsed.education).toHaveLength(1);
    const [edu] = parsed.education;
    expect(edu.school).toBe("North Carolina State University");
    expect(edu.degree).toMatch(/Bachelor of Science/);
    expect(edu.major).toBe("Accounting");
    expect(edu.minor).toBe("Business Analytics");
    expect(edu.gpa).toBe(3.62);
    expect(edu.gradDate).toBe("2028-05");
    expect(edu.coursework).toContain("Federal Income Tax");
    expect(edu.honors[0]).toMatch(/Dean's List/);
  });

  it("splits roles and keeps bullets verbatim, joining wrapped lines", () => {
    const work = parsed.entries.filter((e) => e.section === "experience");
    expect(work.map((e) => e.org)).toEqual(["Oakwood Family Dental", "NC State Bookstores"]);
    expect(work[0].title).toBe("Bookkeeping Assistant (part-time)");
    expect(work[0].location).toBe("Raleigh, NC");
    expect(work[0].startDate).toBe("2025-05");
    expect(work[0].endDate).toBeNull();
    expect(work[0].bullets).toEqual([
      "Reconciled 40+ vendor accounts each month in QuickBooks Online",
      "Built a weekly cash report from bank and QuickBooks data, saving the office manager about 3 hours a week",
    ]);
    expect(work[1]).toMatchObject({ startDate: "2024-08", endDate: "2025-05" });
  });

  it("puts clubs under leadership", () => {
    const [club] = parsed.entries.filter((e) => e.section === "leadership");
    expect(club.org).toBe("Beta Alpha Psi");
    expect(club.title).toBe("Member");
    expect(club.bullets).toHaveLength(1);
  });

  it("reads skills without their labels", () => {
    expect(parsed.skills).toEqual(expect.arrayContaining(["QuickBooks Online", "SQL", "Excel (pivot tables, XLOOKUP)"]));
    expect(parsed.skills.some((s) => s.startsWith("Technical"))).toBe(false);
  });
});

describe("pasted resume edge cases", () => {
  it("splits an organization, title, and dates written on one line", () => {
    const parsed = parseResumeText("Avery Lee\nEXPERIENCE\nBull City Bistro, General Manager, March 2019 - Present\n• Scheduled staff shifts and tracked daily sales");
    expect(parsed.entries[0]).toMatchObject({ org: "Bull City Bistro", title: "General Manager", startDate: "2019-03", endDate: null });
  });

  it("splits a title, organization, place, and dates written on one line", () => {
    const parsed = parseResumeText("Jordan Lee\nEXPERIENCE\nFront Desk Assistant, City Clinic, Greensboro, NC    Jan 2024 - Present\n- Checked in about 30 patients a day");
    expect(parsed.entries[0]).toMatchObject({ org: "City Clinic", title: "Front Desk Assistant", location: "Greensboro, NC", startDate: "2024-01", endDate: null });
  });

  it("recognizes a title line followed by a company line", () => {
    const parsed = parseResumeText("Avery Lee\nEXPERIENCE\nGeneral Manager\nBull City Bistro\n• Scheduled staff shifts and tracked daily sales");
    expect(parsed.entries[0]).toMatchObject({ org: "Bull City Bistro", title: "General Manager" });
  });

  it("keeps a comma inside a school's name when the degree is on that line", () => {
    const parsed = parseResumeText("Avery Lee\nEDUCATION\nUniversity of California, Berkeley, Bachelor of Science in Computer Science, 2018");
    expect(parsed.education[0]).toMatchObject({
      school: "University of California, Berkeley",
      degree: "Bachelor of Science",
      major: "Computer Science",
      gradDate: "2018",
    });
  });

  it("reads one-line education and keeps a certificate date with its credential", () => {
    const parsed = parseResumeText("Avery Lee\nEDUCATION\nDurham Technical Community College, Associate in Applied Science, Hospitality Management, 2016\nCERTIFICATIONS\nCertified Clinical Data Manager (CCDM), 2016");
    expect(parsed.education[0]).toMatchObject({ school: "Durham Technical Community College", degree: "Associate in Applied Science", major: "Hospitality Management", gradDate: "2016" });
    expect(parsed.certifications).toEqual(["Certified Clinical Data Manager (CCDM), 2016"]);
  });
});
describe("dates", () => {
  it.each([
    ["May 2025", "2025-05"],
    ["Sept. 2024", "2024-09"],
    ["05/2025", "2025-05"],
    ["2023", "2023"],
    ["Present", null],
  ])("normalizes %s", (raw, expected) => {
    expect(normalizeDate(raw)).toBe(expected);
  });

  it("finds ranges and current roles", () => {
    expect(findDateRange("Analyst  Jan 2024 – Present")).toMatchObject({ start: "2024-01", end: null, current: true });
    expect(findDateRange("Summer 2025 - Fall 2025")).toMatchObject({ start: "2025-08", end: "2025-12" });
    expect(findDateRange("Expected May 2028")).toMatchObject({ start: null, end: "2028-05" });
  });

  it("borrows the year for a bare starting month", () => {
    expect(findDateRange("NC State VITA Program Jan – Apr 2026")).toMatchObject({ start: "2026-01", end: "2026-04" });
    expect(findDateRange("May-Aug 2025")).toMatchObject({ start: "2025-05", end: "2025-08" });
  });

  it("ignores numbers that aren't years", () => {
    expect(findDateRange("(919) 555-0142")).toBeNull();
    expect(findDateRange("Counted 3,200 SKUs")).toBeNull();
  });

  it("formats ranges for display", () => {
    expect(formatRange("2025-05", null)).toBe("May 2025 – Present");
    expect(formatRange("2024-08", "2025-05")).toBe("Aug 2024 – May 2025");
  });
});

describe("trailingPlace", () => {
  it.each([
    ["Raleigh, NC", "Raleigh, NC", ""],
    ["Volunteer Tax Preparer Raleigh, NC", "Raleigh, NC", "Volunteer Tax Preparer"],
    ["Bookkeeping Assistant (part-time) Raleigh, NC", "Raleigh, NC", "Bookkeeping Assistant (part-time)"],
    ["North Carolina State University, Raleigh, NC", "Raleigh, NC", "North Carolina State University"],
    ["Summer Analyst New York, NY", "New York, NY", "Summer Analyst"],
    ["Salt Lake City, UT", "Salt Lake City, UT", ""],
    ["Beta Alpha Psi Durham, NC", "Durham, NC", "Beta Alpha Psi"],
    ["Remote", "Remote", ""],
  ])("reads %s", (part, place, rest) => {
    expect(trailingPlace(part)).toEqual({ place, rest });
  });

  it("needs a real state", () => {
    expect(trailingPlace("Smith, JD")).toBeNull();
  });
});

describe("glyph-free bullets", () => {
  it("treats full sentences under a role as bullets", () => {
    const parsed = parseResumeText(
      "Sam Lee\nEXPERIENCE\nCampus Dining   Aug 2024 – Present\nShift Lead\nTrained new hires on the register and closing checklist every week.\nKept the line under five minutes during the lunch rush most days.",
    );
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]).toMatchObject({ org: "Campus Dining", title: "Shift Lead" });
    expect(parsed.entries[0].bullets).toHaveLength(2);
  });
});

describe("links", () => {
  it("doesn't mistake an email domain for a portfolio link", () => {
    const parsed = parseResumeText("Sam Lee\nsam@example.com | github.com/samlee\nEDUCATION\nState University");
    expect(parsed.links).toEqual(["github.com/samlee"]);
  });
});

// Shapes from a real Word-made resume: Symbol-font bullets (U+F0B7), degree-first
// education lines, a GPA written before "GPA", wrapped coursework, and labeled skill lines.
describe("Word-made resumes", () => {
  const B = "";
  const text = [
    "Casey Morgan",
    "Durham, NC | 919.555.0101 | casey@example.com",
    "EDUCATION",
    "Master of Science in Accounting, UNC Greensboro | January 2027 to June 2027",
    "Bachelor of Science in Accounting, UNC Greensboro | Expected December 2026 | 3.69 GPA | Dean's List",
    "Relevant Coursework: Federal Tax Concepts (prepared tax returns, Grade A), Auditing, Cost",
    "Accounting, Corporate Finance",
    "EXPERIENCE",
    "Licensed Insurance Agent | Bankers Life, Greensboro, NC",
    "June 2026 to Present",
    `${B} Guide 50+ clients through tax implications of RMDs and Roth conversions across`,
    "25+ appointments, explaining the rules in plain language.",
    `${B} Write 12 policies since June 2026 by running client appointments solo.`,
    "Treasurer | UNCG Investment Club",
    "August 2024 to August 2026",
    `${B} Trained 10+ members on treasurer procedures and record-`,
    "keeping.",
    "SKILLS",
    "Technical: Excel, Python, Tableau",
    "Licenses: NC Life & Health | SIE scheduled December 14, 2026",
    "Interests: AI tools and data analytics",
  ].join("\n");
  const parsed = parseResumeText(text);

  it("reads Symbol-font bullets and rejoins wrapped lines, including hyphen breaks", () => {
    expect(parsed.entries.map((e) => [e.title, e.org, e.bullets.length])).toEqual([
      ["Licensed Insurance Agent", "Bankers Life", 2],
      ["Treasurer", "UNCG Investment Club", 1],
    ]);
    expect(parsed.entries[0].bullets[0]).toBe("Guide 50+ clients through tax implications of RMDs and Roth conversions across 25+ appointments, explaining the rules in plain language.");
    expect(parsed.entries[1].bullets[0]).toBe("Trained 10+ members on treasurer procedures and record-keeping.");
  });

  it("reads degree-first education, a GPA before the word GPA, honors, and wrapped coursework", () => {
    expect(parsed.education).toMatchObject([
      { school: "UNC Greensboro", degree: "Master of Science", major: "Accounting", gradDate: "2027-06" },
      { school: "UNC Greensboro", degree: "Bachelor of Science", major: "Accounting", gradDate: "2026-12", gpa: 3.69, honors: ["Dean's List"], coursework: ["Federal Tax Concepts (prepared tax returns, Grade A)", "Auditing", "Cost Accounting", "Corporate Finance"] },
    ]);
  });

  it("sends licenses to certifications and leaves interests out of skills", () => {
    expect(parsed.skills).toEqual(["Excel", "Python", "Tableau"]);
    expect(parsed.certifications).toEqual(["NC Life & Health", "SIE scheduled December 14, 2026"]);
  });
});
