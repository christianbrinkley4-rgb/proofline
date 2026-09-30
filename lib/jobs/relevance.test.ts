import { describe, expect, it } from "vitest";
import { hasUsableJobDescription } from "./description";
import { courseRelevance, postingOverlap } from "./relevance";

describe("job description grounding", () => {
  it("requires actual posting text for a tailored draft", () => {
    expect(hasUsableJobDescription(null)).toBe(false);
    expect(hasUsableJobDescription("Description unavailable. See posting for details." )).toBe(false);
    expect(hasUsableJobDescription("Tutor needed to explain algebra, prepare practice problems, and support high school students each week.")).toBe(true);
  });

  it("ranks repeated role terms above incidental shared words", () => {
    const posting = "Tutor students in algebra and prepare clear updates. Experience explaining algebra problems is required.";
    expect(postingOverlap("Explained algebra problems to students", posting)).toBeGreaterThan(postingOverlap("Shared office updates with a manager", posting));
  });

  it("ranks a course by the subject the posting keeps asking about", () => {
    const tax = "Prepare federal income tax returns, research tax issues, calculate tax provisions. Coursework in federal income taxation. Data analytics tools a plus.";
    expect(courseRelevance("Federal Tax Concepts (prepared tax returns, Grade A)", tax)).toBeGreaterThan(courseRelevance("Data Analytics", tax));
    // A note in parentheses and words like "Concepts" say nothing about the subject.
    expect(courseRelevance("Concepts (tax returns)", tax)).toBe(0);
    expect(courseRelevance("Auditing", null)).toBe(0);
  });
});
