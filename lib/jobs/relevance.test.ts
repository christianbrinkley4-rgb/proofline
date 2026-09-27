import { describe, expect, it } from "vitest";
import { hasUsableJobDescription } from "./description";
import { postingOverlap } from "./relevance";

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
});
