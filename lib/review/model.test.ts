import { afterEach, describe, expect, it, vi } from "vitest";
import { canSignUp } from "@/lib/beta-access";
import { employerWording } from "@/lib/resume/tailor-best";
import { buildReviewInput, modelReview, REVIEW_SYSTEM_PROMPT, settleVerdict } from "./model";

afterEach(() => vi.unstubAllEnvs());

const RESUME = "- Reconciled 40+ vendor accounts each month, catching $3,200 in duplicate payments\n- Answered billing questions by phone";
const FACTS = ["Reconciled 40+ vendor accounts each month, catching $3,200 in duplicate payments", "Answered billing questions by phone"];

describe("model review rules, enforced in code", () => {
  it("keeps the spec's rules in the system prompt", () => {
    expect(REVIEW_SYSTEM_PROMPT).toContain("reads like a first-round interview candidate at a top firm");
    expect(REVIEW_SYSTEM_PROMPT).toContain("search the ENTIRE facts list and quote the closest supporting line");
    expect(REVIEW_SYSTEM_PROMPT).toContain("Prove support, don't hunt guilt. PASS if all bullets have support.");
    expect(REVIEW_SYSTEM_PROMPT).toContain("You may NOT fail for: contractions, date abbreviations");
  });

  it("drops issues it can't quote verbatim, and a FAIL with nothing left becomes a PASS", () => {
    const out = settleVerdict({ verdict: "FAIL", issues: [{ quote: "Led a team of 12", rule_broken: "unsupported", fix: "Remove it" }] }, RESUME, FACTS);
    expect(out).toEqual({ status: "pass", issues: [] });
  });

  it("drops a fix that adds a number the person never confirmed", () => {
    const out = settleVerdict({ verdict: "FAIL", issues: [{ quote: "Answered billing questions by phone", rule_broken: "no number", fix: "Say you answered 50 calls a day" }] }, RESUME, FACTS);
    expect(out.status).toBe("pass");
  });

  it("keeps a real, quotable issue", () => {
    const out = settleVerdict({ verdict: "FAIL", issues: [{ quote: "Answered billing questions by phone", rule_broken: "weak opener", fix: "Lead with what changed for patients" }] }, RESUME, FACTS);
    expect(out.status).toBe("fail");
    expect(out.issues).toHaveLength(1);
  });

  it("stays inside the prompt budget with a long fact list", () => {
    const input = buildReviewInput({ requirements: "x".repeat(5000), resumeText: RESUME, facts: Array.from({ length: 400 }, (_, i) => `Fact number ${i} with some words in it`) });
    expect((input.length + REVIEW_SYSTEM_PROMPT.length) / 4).toBeLessThan(4000);
  });

  it("says unavailable, never throws, without a key", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "");
    const out = await modelReview("nobody", { requirements: "", resumeText: RESUME, facts: FACTS });
    expect(out.status).toBe("unavailable");
    expect(out.message).toMatch(/temporarily unavailable/);
  });
});

describe("private beta allowlist", () => {
  it("lets only listed addresses sign up, any case", () => {
    const env = { BETA_EMAILS: "Ana@School.edu, sam@proofline.test", NODE_ENV: "production" };
    expect(canSignUp("ana@school.edu", env)).toBe(true);
    expect(canSignUp(" SAM@proofline.test ", env)).toBe(true);
    expect(canSignUp("stranger@proofline.test", env)).toBe(false);
  });
  it("opens sign-up to any real email with *", () => {
    const open = { BETA_EMAILS: "*", NODE_ENV: "production" };
    expect(canSignUp("stranger@proofline.test", open)).toBe(true);
    expect(canSignUp("Someone@School.EDU", { BETA_EMAILS: "ana@school.edu, *", NODE_ENV: "production" })).toBe(true);
    expect(canSignUp("not-an-email", open)).toBe(false);
    expect(canSignUp("a@b", open)).toBe(false);
  });
  it("closes sign-up when the list is empty", () => {
    expect(canSignUp("ana@school.edu", { BETA_EMAILS: "", NODE_ENV: "production" })).toBe(false);
  });
  it("allows the dev helper accounts only in development", () => {
    expect(canSignUp("dev.new.1@example.com", { NODE_ENV: "development" })).toBe(true);
    expect(canSignUp("dev.new.1@example.com", { NODE_ENV: "production" })).toBe(false);
  });
});

describe("employer wording", () => {
  it("uses the posting's form of the same skill and keeps the person's otherwise", () => {
    expect(employerWording("Account reconciliation", "Experience with account reconciliations required")).toBe("Account reconciliations");
    expect(employerWording("Accounts payable", "Process A/P for 30 vendors")).toBe("Accounts payable (A/P)");
    // Case alone never changes, so one list keeps one capitalization style.
    expect(employerWording("Data Analytics", "Organize data and apply data analytics to trends")).toBeNull();
    expect(employerWording("Financial Statement", "Review financial statements monthly")).toBe("Financial Statements");
    // A more specific tool name is a different claim; never swapped in.
    expect(employerWording("Excel", "Advanced pivot tables and VLOOKUP")).toBeNull();
    // The posting's own capitals never override the person's: QuickBooks stays QuickBooks.
    expect(employerWording("QuickBooks", "Proficient in Excel; QuickBooks a plus")).toBeNull();
    expect(employerWording("QuickBooks", "Experience with Quickbooks required")).toBeNull();
  });
});
