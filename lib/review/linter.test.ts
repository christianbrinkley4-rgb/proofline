import { describe, expect, it } from "vitest";
import { blockingFailures, enforceQuotes, lintResume, type LintCheck } from "./linter";

const FACTS = [
  "Jordan Reyes",
  "North Carolina State University",
  "Bachelor of Science",
  "Accounting",
  "May 2028",
  "3.6",
  "Bookkeeping Assistant",
  "Oakwood Family Dental",
  "Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments",
  "Processed about 60 invoices a week for 3 dentists",
  "Volunteer Tax Preparer",
  "NC State VITA Program",
  "Prepared 25 federal and state returns for students and families",
  "Excel",
  "QuickBooks",
];

const STRONG = [
  "Jordan Reyes",
  "Raleigh, NC | jordan@example.com | (919) 555-0142",
  "EDUCATION",
  "**North Carolina State University** | Expected May 2028",
  "Bachelor of Science in Accounting",
  "GPA: 3.6/4.0",
  "EXPERIENCE",
  "**Bookkeeping Assistant** | Oakwood Family Dental | Raleigh, NC | May 2025 – Present",
  "- Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments",
  "- Processed about 60 invoices a week for 3 dentists",
  "**Volunteer Tax Preparer** | NC State VITA Program | Jan 2026 – Apr 2026",
  "- Prepared 25 federal and state returns for students and families",
  "SKILLS",
  "Technical: Excel, QuickBooks",
].join("\n");

const JD = "Staff Accountant Intern. Requirements: account reconciliation, journal entries, Excel, QuickBooks.";

const byId = (checks: LintCheck[], id: LintCheck["id"]) => checks.find((c) => c.id === id)!;

describe("review linter", () => {
  it("passes a strong, fully supported resume on every blocking check", () => {
    const checks = lintResume({ resumeText: STRONG, jobDescription: JD, userFacts: FACTS, pageCount: 1 });
    expect(blockingFailures(checks)).toEqual([]);
    expect(checks.filter((c) => !c.passed).map((c) => c.id)).toEqual([]);
  });

  it("fails one invented statistic, quoting it", () => {
    const invented = STRONG.replace("catching $3,200 in duplicate payments", "catching $9,800 in duplicate payments");
    const check = byId(lintResume({ resumeText: invented, jobDescription: JD, userFacts: FACTS, pageCount: 1 }), "no_unconfirmed_claims");
    expect(check.passed).toBe(false);
    expect(check.severity).toBe("BLOCKING");
    expect(check.evidence_quote).toBe("$9,800");
    expect(invented).toContain(check.evidence_quote);
  });

  it("fails a skill and a role nobody confirmed", () => {
    const text = STRONG.replace("Technical: Excel, QuickBooks", "Technical: Excel, QuickBooks, SAP").replace("**Volunteer Tax Preparer**", "**Senior Tax Manager**");
    const check = byId(lintResume({ resumeText: text, jobDescription: JD, userFacts: FACTS, pageCount: 1 }), "no_unconfirmed_claims");
    expect(check.failures).toEqual(expect.arrayContaining(["SAP", "Senior Tax Manager"]));
  });

  it("blocks em dashes, citizenship, job numbers, pay amounts, and machine phrases", () => {
    const text = STRONG.replace("- Processed about 60 invoices a week for 3 dentists", "- Processed about 60 invoices a week — for 3 dentists, a testament to my focus (Req #48213, US citizen, $5,000 signing bonus)");
    const checks = lintResume({ resumeText: text, jobDescription: JD, userFacts: FACTS, pageCount: 1 });
    expect(byId(checks, "no_em_dashes").passed).toBe(false);
    const banned = byId(checks, "no_banned_content");
    expect(banned.passed).toBe(false);
    expect(banned.failures).toEqual(expect.arrayContaining(["US citizen", "Req #48213", "testament to"]));
    expect(banned.failures.some((q) => q.startsWith("$5,000"))).toBe(true);
  });

  it("flags weak openers, bullets without numbers, and filler, each quoted", () => {
    const text = STRONG.replace("- Processed about 60 invoices a week for 3 dentists", "- Responsible for leveraging invoices for the dentists");
    const checks = lintResume({ resumeText: text, jobDescription: JD, userFacts: [...FACTS, "Responsible for leveraging invoices for the dentists"], pageCount: 1 });
    expect(byId(checks, "bullets_start_with_verb").evidence_quote).toBe("Responsible for leveraging");
    expect(byId(checks, "bullets_have_numbers").failures).toEqual(["Responsible for leveraging invoices for the dentists"]);
    expect(byId(checks, "no_corporate_filler").failures).toEqual(["leveraging"]);
    expect(blockingFailures(checks)).toEqual([]);
  });

  it("checks bold, spacing, skills repeats, and dates", () => {
    const text = STRONG.replace("**Bookkeeping Assistant** | Oakwood Family Dental", "Bookkeeping Assistant | **Oakwood Family Dental**")
      .replace("Technical: Excel, QuickBooks", "Technical: Excel, QuickBooks, excel")
      .replace("Jan 2026 – Apr 2026", "01/2026 – 04/2026")
      .replace("in Accounting", "in  Accounting");
    const checks = lintResume({ resumeText: text, jobDescription: JD, userFacts: FACTS, pageCount: 1 });
    expect(byId(checks, "consistent_bold").passed).toBe(false);
    expect(byId(checks, "no_duplicate_words_in_skills").failures).toEqual(["excel"]);
    expect(byId(checks, "consistent_date_format").passed).toBe(false);
    expect(byId(checks, "no_trailing_or_double_spaces").evidence_quote).toBe("in  Accounting");
  });

  it("reports keyword overlap as information only", () => {
    const check = byId(lintResume({ resumeText: STRONG, jobDescription: JD, userFacts: FACTS, pageCount: 1 }), "jd_keyword_overlap");
    expect(check.severity).toBe("INFO");
    expect(check.passed).toBe(true);
    expect(check.detail).toMatch(/Not on the page: .*journal entry/);
  });

  it("uses the measured page count, and the line heuristic without one", () => {
    expect(byId(lintResume({ resumeText: STRONG, jobDescription: JD, userFacts: FACTS, pageCount: 2 }), "one_page").passed).toBe(false);
    const long = `${STRONG}\n${Array.from({ length: 60 }, (_, i) => `- Processed about 60 invoices a week for 3 dentists ${"x".repeat(i % 3)}`).join("\n")}`;
    const heuristic = byId(lintResume({ resumeText: long, jobDescription: JD, userFacts: FACTS }), "one_page");
    expect(heuristic.passed).toBe(false);
    expect(long).toContain(heuristic.evidence_quote);
  });

  it("passes any failure it cannot quote verbatim", () => {
    const [check] = enforceQuotes(
      [{ id: "no_unconfirmed_claims", label: "x", severity: "BLOCKING", passed: false, evidence_quote: "not on the page", failures: ["not on the page"], detail: "x" }],
      STRONG,
    );
    expect(check.passed).toBe(true);
  });
});
