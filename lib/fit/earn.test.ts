import { describe, expect, it } from "vitest";
import { findVoiceIssues } from "@/lib/voice/rules";
import { EARNABLE_SKILLS, earnPath } from "./earn";
import { SKILLS } from "./skills";

describe("ways to earn a missing skill", () => {
  it("only covers skills the matcher knows, so a path always lines up with a gap", () => {
    const known = new Set(SKILLS.map((s) => s.name));
    expect(EARNABLE_SKILLS.filter((s) => !known.has(s))).toEqual([]);
  });

  it("finds the path from the way a posting writes the skill", () => {
    expect(earnPath("QuickBooks Online")?.skill).toBe("QuickBooks");
    expect(earnPath("reconciliations")?.skill).toBe("Account reconciliation");
    expect(earnPath("SQL")?.resource?.url).toBe("https://sqlbolt.com/");
  });

  it("offers nothing for soft skills, credentials, or systems students can't get into", () => {
    for (const skill of ["Teamwork", "Communication", "CPA", "CFA", "SAP", "NetSuite", "Workday", "Spanish"]) expect(earnPath(skill)).toBeNull();
  });

  it("links only to https pages and writes in the product's voice", () => {
    for (const skill of EARNABLE_SKILLS) {
      const path = earnPath(skill)!;
      if (path.resource) expect(path.resource.url).toMatch(/^https:\/\//);
      expect(findVoiceIssues(`${path.project} ${path.time}`)).toEqual([]);
      expect(path.project.endsWith(".")).toBe(true);
    }
  });
});
