import { describe, expect, it } from "vitest";
import { suggestedSkillsFor } from "./suggested-skills";

describe("onboarding skill examples", () => {
  it("asks a restaurant manager about relevant work rather than accounting software", () => {
    const examples = suggestedSkillsFor([{ title: "General Manager", org: "Bull City Bistro" }]);
    expect(examples).toContain("Point-of-sale systems");
    expect(examples).not.toContain("QuickBooks");
  });
  it("offers clinical data tools to a specialist, not hospital intake tools", () => {
    const examples = suggestedSkillsFor([{ title: "Clinical Data Manager", org: "Oncology research team" }]);
    expect(examples).toContain("Medidata Rave");
    expect(examples).toContain("CDISC");
    expect(examples).not.toContain("Patient intake");
  });
  it("uses broad examples before a person has named work", () => {
    expect(suggestedSkillsFor([])).toContain("Customer service");
  });
});
