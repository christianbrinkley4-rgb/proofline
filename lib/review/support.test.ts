import { describe, expect, it } from "vitest";
import { contentTokens, supportingFact } from "./support";

const FACTS = [
  "Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments",
  "Helped the office manager build a cash report that pulls bank and QuickBooks data into one sheet",
  "Built an Excel tracker for 300+ SKUs that cut month-end inventory counts from 2 days to 6 hours",
];

describe("whether a line is verifiably in the confirmed facts", () => {
  it("finds the fact a resume line is, word for word", () => {
    expect(supportingFact("- Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments", FACTS)).toBe(FACTS[0]);
    expect(supportingFact("**Reconciled** 40+ vendor accounts each month in QuickBooks Online", FACTS)).toBe(FACTS[0]);
  });

  it("allows the opening verb in another tense, which is all the resume changes", () => {
    expect(supportingFact("Build an Excel tracker for 300+ SKUs that cut month-end inventory counts from 2 days to 6 hours", FACTS)).toBe(FACTS[2]);
    expect(supportingFact("Reconcile 40+ vendor accounts each month in QuickBooks Online", FACTS)).toBe(FACTS[0]);
  });

  it("does not call a changed claim supported", () => {
    // The fact says helped; a line that says led has a word no fact holds.
    expect(supportingFact("Led the office manager build a cash report that pulls bank and QuickBooks data into one sheet", FACTS)).toBeNull();
    // A different number is a different claim.
    expect(supportingFact("Reconciled 400+ vendor accounts each month in QuickBooks Online", FACTS)).toBeNull();
    // A tool, scope, or result the facts never mention.
    expect(supportingFact("Reconciled 40+ vendor accounts each month in SAP, catching $3,200 in duplicate payments", FACTS)).toBeNull();
    expect(supportingFact("Reconciled 40+ vendor accounts each month in QuickBooks Online and trained two new hires", FACTS)).toBeNull();
  });

  it("will not vouch for a line too short to mean anything", () => {
    expect(supportingFact("Reconciled vendor accounts", FACTS)).toBeNull();
    expect(supportingFact("Used QuickBooks", FACTS)).toBeNull();
  });

  it("lets a letter sentence name an employer that no fact holds", () => {
    const sentence = "At Oakwood Family Dental, I reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments.";
    expect(supportingFact(sentence, FACTS)).toBeNull();
    expect(supportingFact(sentence, FACTS, ["Oakwood Family Dental", "Bookkeeping Assistant"])).toBe(FACTS[0]);
  });

  it("reads the same word in any form as one word, and skips connecting words", () => {
    expect(contentTokens("Reconciled the accounts")).toEqual(contentTokens("Reconcile accounts"));
    expect(contentTokens("Processed 3,200 payments")).toContain("3200");
    expect(contentTokens("- **Led** a team of 5")).toEqual(["led", "team", "5"]);
  });
});
