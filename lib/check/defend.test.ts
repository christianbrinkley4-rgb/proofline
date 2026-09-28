import { describe, expect, it } from "vitest";
import { parseResumeText } from "@/lib/resume/parse/rules";
import { defendReport, displayTerm, followUp, lintText } from "./defend";

const PASTED = `Jordan Rivera
Raleigh, NC | jordan@example.com | (919) 555-0142

EDUCATION
North Carolina State University, Raleigh, NC
Bachelor of Science in Accounting, May 2027

EXPERIENCE
Bookkeeping Assistant, Oakwood Family Dental, Raleigh, NC
May 2025 - Present
• Reconciled 40+ vendor accounts each month in QuickBooks Online
• Cut invoice errors by 25% by adding a weekly review
• Responsible for various office tasks
• Leveraged synergies to drive results

Operations Intern, Durham Food Bank, Durham, NC
Jun 2024 - Aug 2024
• Saved $3,200 in duplicate payments during the spring audit
• Significantly improved volunteer scheduling

SKILLS
Excel, QuickBooks Online, Excel, Google Sheets`;

const JOB = `Staff Accountant Intern. You will reconcile vendor accounts, record journal entries, and prepare month-end close schedules in QuickBooks and Excel. Experience with accounts payable is a plus. Strong attention to detail required.`;

describe("the public defend-every-line check", () => {
  const parsed = parseResumeText(PASTED);
  const report = defendReport(parsed, JOB);

  it("finds every line with a number and asks the question an interviewer would", () => {
    expect(report.claims.map((c) => c.numbers[0])).toEqual(["40+", "25%", "$3,200"]);
    expect(report.claims[1].question).toMatch(/before.*after/);
    expect(report.claims[2].question).toMatch(/dollar figure/);
  });

  it("flags words that promise scale without a measure, with the question each one invites", () => {
    expect(report.vague.map((v) => v.word.toLowerCase())).toEqual(["various", "significantly"]);
    expect(report.vague[0].question).toBe('"Various": how many? Put the number in, or cut the word.');
    expect(report.vague[1].question).toBe('"Significantly": by how much? Put the number in, or cut the word.');
  });

  it("speaks to someone without an account", () => {
    const numbers = report.checks.find((c) => c.id === "bullets_have_numbers")!;
    expect(numbers.detail).not.toMatch(/fact/);
  });

  it("shows posting terms the way the posting wrote them", () => {
    expect(displayTerm("account payable", JOB)).toBe("accounts payable");
    expect(displayTerm("quickbooks", JOB)).toBe("QuickBooks");
    expect(displayTerm("journal entry", JOB)).toBe("journal entries");
    expect(displayTerm("account reconciliation", JOB)).toBe("Account reconciliation");
  });

  it("runs only the content checks and catches filler, weak openers, and repeated skills", () => {
    const failing = report.checks.filter((c) => !c.passed).map((c) => c.id);
    expect(failing).toEqual(expect.arrayContaining(["bullets_start_with_verb", "bullets_have_numbers", "no_duplicate_words_in_skills"]));
    expect(report.checks.map((c) => c.id)).not.toContain("no_unconfirmed_claims");
    expect(report.checks.map((c) => c.id)).not.toContain("one_page");
    expect(report.passed).toBe(report.checks.filter((c) => c.passed).length);
  });

  it("compares against a posting only when one is given", () => {
    expect(report.keywords?.matched.length).toBeGreaterThan(0);
    expect(defendReport(parsed).keywords).toBeNull();
  });

  it("rebuilds the text the linter reads", () => {
    const text = lintText(parsed);
    expect(text.split("\n")[0]).toBe("Jordan Rivera");
    expect(text).toContain("- Reconciled 40+ vendor accounts each month in QuickBooks Online");
  });

  it("picks a question by the kind of number", () => {
    expect(followUp(["3x"])).toMatch(/starting point/);
    expect(followUp(["12"])).toMatch(/count/);
  });
});
