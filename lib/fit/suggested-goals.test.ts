import { describe, expect, it } from "vitest";
import { suggestedGoalsFor } from "./suggested-goals";

describe("suggestedGoalsFor", () => {
  it("offers hospitality paths to a restaurant manager", () => {
    const suggestions = suggestedGoalsFor([{ title: "General Manager", org: "Bull City Bistro" }]);
    expect(suggestions.roles[0]).toBe("Restaurant general manager");
    expect(suggestions.industries).toContain("Hospitality");
    expect(suggestions.dealBreakers).not.toContain("Requires a CPA already");
  });

  it("offers clinical data paths to a clinical data manager", () => {
    const suggestions = suggestedGoalsFor([{ title: "Clinical Data Manager", org: "Trial Research" }]);
    expect(suggestions.roles).toContain("Clinical data lead");
    expect(suggestions.industries).toContain("Clinical research");
  });

  it("gives broad choices without experience", () => {
    const suggestions = suggestedGoalsFor([]);
    expect(suggestions.roles).toContain("Warehouse associate");
    expect(suggestions.roles).toContain("Medical assistant");
  });
});
