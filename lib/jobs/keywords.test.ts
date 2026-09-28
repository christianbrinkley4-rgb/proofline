import { describe, expect, it } from "vitest";
import { extractKeywords, matchKeywords, normalizePhrase, singular } from "./keywords";

const POSTING = `Staff Accountant Intern
Requirements:
- Experience with journal entries and account reconciliations
- Proficiency in Excel and QuickBooks; NetSuite a plus
- Prepare vendor payments and support month-end close
- Help with vendor payments during month-end close
Benefits: health insurance, 401(k), paid time off.
We are an equal opportunity employer.`;

describe("posting keywords", () => {
  it("normalizes case and plurals", () => {
    expect(singular("entries")).toBe("entry");
    expect(singular("classes")).toBe("class");
    expect(singular("analysis")).toBe("analysis");
    expect(normalizePhrase("Journal Entries")).toBe("journal entry");
  });

  it("finds skills, tools, and repeated phrases, and skips boilerplate", () => {
    const keywords = extractKeywords(POSTING);
    expect(keywords).toEqual(expect.arrayContaining(["journal entry", "account reconciliation", "excel", "quickbooks", "netsuite", "vendor payment", "month-end close"]));
    expect(keywords.some((k) => /insurance|401|equal/.test(k))).toBe(false);
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it("matches keywords by phrase or by the same skill", () => {
    const keywords = ["journal entry", "excel", "netsuite"];
    const found = matchKeywords(keywords, "Posted Journal Entries weekly; built pivot tables in Excel");
    expect(found.matched).toEqual(["journal entry", "excel"]);
    expect(found.missing).toEqual(["netsuite"]);
  });
});
