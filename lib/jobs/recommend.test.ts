import { describe, expect, it } from "vitest";
import { recommendRoles } from "./recommend";

describe("recommendRoles", () => {
  it("uses a stated student goal and confirmed transferable skills", () => {
    const roles = recommendRoles({
      targetRoles: ["Accounting intern"],
      confirmedFacts: [
        { content: "Excel", category: "skill" },
        { content: "Helped customers with returns", category: "experience", experienceId: "store" },
        { content: "QuickBooks", category: "tool" },
      ],
      experiences: [{ id: "store", title: "Sales associate" }],
    });
    expect(roles[0]).toMatchObject({ id: "accounting", source: "goal", query: "Accounting intern" });
    expect(roles.some((r) => r.id === "customer-service" && r.reason.includes("Helped customers"))).toBe(true);
  });

  it("works without college history or an internship", () => {
    const roles = recommendRoles({
      targetRoles: ["Not sure"],
      confirmedFacts: [
        { content: "Managed inventory and shipping", category: "experience", experienceId: "work" },
        { content: "Scheduled shifts", category: "experience", experienceId: "work" },
      ],
      experiences: [{ id: "work", title: "Warehouse associate" }],
    });
    expect(roles.map((r) => r.id)).toContain("warehouse");
    expect(roles.map((r) => r.id)).toContain("administration");
    expect(roles.every((r) => r.source === "profile")).toBe(true);
  });

  it("does not use an experience title without a confirmed fact attached", () => {
    const roles = recommendRoles({
      targetRoles: [],
      confirmedFacts: [],
      experiences: [{ id: "imported", title: "Software Engineer" }],
    });
    expect(roles).toEqual([]);
  });

  it("does not turn a preference or contact detail into career evidence", () => {
    const roles = recommendRoles({
      targetRoles: [],
      confirmedFacts: [{ content: "I do not want sales jobs", category: "preference" }],
      experiences: [],
    });
    expect(roles).toEqual([]);
  });

  it("keeps unknown stated goals without inventing nearby paths", () => {
    const roles = recommendRoles({ targetRoles: ["Teacher"], confirmedFacts: [], experiences: [] });
    expect(roles).toEqual([{ id: "goal:teacher", label: "Teacher", query: "Teacher", source: "goal", reason: "You listed Teacher as a goal." }]);
  });
});
