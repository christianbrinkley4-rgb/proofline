import { describe, expect, it } from "vitest";
import { parseRequirements, REQUIREMENTS_VERSION } from "@/lib/fit/requirements";
import { requirementsOf } from "./store";

const description = "Qualifications\n- Proficient in Excel; QuickBooks a plus\n- Graduating by June 2027";

describe("stored posting requirements", () => {
  it("reads a job saved by an older parser again, so fixes reach saved jobs", () => {
    const old = { ...parseRequirements(description), required: [], preferred: ["Excel", "QuickBooks"], gradWindow: null, version: undefined };
    const fresh = requirementsOf({ requirements: old as never, description });
    expect(fresh.version).toBe(REQUIREMENTS_VERSION);
    expect(fresh.required).toContain("Excel");
    expect(fresh.gradWindow).toMatchObject({ to: "2027-06" });
  });

  it("keeps a current stored copy, and any stored copy when the text isn't loaded", () => {
    const current = { ...parseRequirements(description), required: ["Stored"] };
    expect(requirementsOf({ requirements: current as never, description }).required).toEqual(["Stored"]);
    const old = { ...current, version: undefined };
    expect(requirementsOf({ requirements: old as never, description: null }).required).toEqual(["Stored"]);
  });
});
