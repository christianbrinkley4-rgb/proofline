import { describe, expect, it } from "vitest";
import { parseRequirements } from "./requirements";
import { checkKnockouts, firstKnockout, parseStartDate, type KnockoutCandidate } from "./knockouts";

const candidate: KnockoutCandidate = {
  gradDate: "2026-05",
  workAuthorization: "us_citizen",
  targetLocations: ["Raleigh, NC"],
  workModes: ["onsite", "hybrid", "remote"],
  openToRelocate: false,
  availableFrom: "2026-06",
};

const job = (description: string, extra: Partial<{ title: string; location: string | null; mode: "remote" | "hybrid" | "onsite" | "unknown" }> = {}) => ({
  title: extra.title ?? "Analyst",
  location: extra.location === undefined ? "Raleigh, NC" : extra.location,
  mode: extra.mode ?? "onsite",
  description,
  requirements: parseRequirements(description),
});

describe("knockouts", () => {
  it("knocks out a 2028 graduation window for a 2026 graduate, in plain words", () => {
    const result = checkKnockouts(job("Open to students in the Class of 2028. Excel required."), candidate);
    const knockout = firstKnockout(result);
    expect(knockout?.key).toBe("graduation");
    expect(knockout?.reason).toBe("This role is for students graduating in 2028. You graduate May 2026.");
  });

  it("passes a graduation window that fits", () => {
    const result = checkKnockouts(job("Open to students in the Class of 2026."), candidate);
    expect(result.find((k) => k.key === "graduation")?.status).toBe("ok");
  });

  it("knocks out no-sponsorship roles for someone who needs sponsorship", () => {
    const result = checkKnockouts(job("We are unable to sponsor visas for this position."), { ...candidate, workAuthorization: "needs_sponsorship" });
    expect(firstKnockout(result)?.key).toBe("work_authorization");
  });

  it("knocks out citizenship-only roles for a permanent resident", () => {
    const result = checkKnockouts(job("Must be a U.S. citizen due to government contracts."), { ...candidate, workAuthorization: "permanent_resident" });
    expect(firstKnockout(result)?.reason).toMatch(/citizenship/);
  });

  it("knocks out an on-site role outside the listed places when they won't move", () => {
    const result = checkKnockouts(job("Work in our Seattle office.", { location: "Seattle, WA" }), candidate);
    expect(firstKnockout(result)?.key).toBe("location");
  });

  it("knocks out an on-site role for a remote-only person", () => {
    const result = checkKnockouts(job("On-site five days a week."), { ...candidate, workModes: ["remote"] });
    expect(firstKnockout(result)?.reason).toMatch(/only work remote/);
  });

  it("never knocks out a remote role on location", () => {
    const result = checkKnockouts(job("Fully remote.", { location: "Remote", mode: "remote" }), { ...candidate, targetLocations: [] });
    expect(result.find((k) => k.key === "location")?.status).toBe("ok");
  });

  it("knocks out a start date before the person is available", () => {
    const result = checkKnockouts(job("Start date: January 2026. Full time."), { ...candidate, availableFrom: "2026-06" });
    expect(firstKnockout(result)?.key).toBe("start_date");
  });

  it("says unknown, never knockout, when the person hasn't told us", () => {
    const result = checkKnockouts(job("Class of 2028 only. We will not sponsor visas. Start date: January 2026.", { location: "Seattle, WA" }), {
      gradDate: null,
      workAuthorization: null,
      targetLocations: [],
      workModes: [],
      openToRelocate: null,
      availableFrom: null,
    });
    expect(firstKnockout(result)).toBeNull();
    expect(result.filter((k) => k.status === "unknown").map((k) => k.key)).toEqual(["graduation", "work_authorization", "location", "start_date"]);
  });

  it("reads season starts and specific dates", () => {
    expect(parseStartDate("Summer 2027 Audit Internship")?.month).toBe("2027-06");
    expect(parseStartDate("Audit Associate Intern, Summer 2027")?.month).toBe("2027-06");
    expect(parseStartDate("Anticipated start date: September 8, 2026")?.month).toBe("2026-09");
    expect(parseStartDate("A starting salary of $60,000")).toBeNull();
  });
});

describe("one-sided graduation limits", () => {
  it("reads \"graduating by June 2027\" as a latest date, not a single month", () => {
    const posting = "Pursuing a bachelor's or master's degree in accounting, graduating by June 2027.";
    expect(parseRequirements(posting).gradWindow).toMatchObject({ from: null, to: "2027-06" });
    const early = checkKnockouts(job(posting), { ...candidate, gradDate: "2026-12" }).find((k) => k.key === "graduation");
    expect(early).toMatchObject({ status: "ok", reason: "Your Dec 2026 graduation fits. They want students graduating by Jun 2027." });
    const late = checkKnockouts(job(posting), { ...candidate, gradDate: "2028-05" }).find((k) => k.key === "graduation");
    expect(late?.status).toBe("knockout");
  });

  it("reads \"graduation no earlier than December 2026\" as an earliest date", () => {
    expect(parseRequirements("Expected graduation no earlier than December 2026.").gradWindow).toMatchObject({ from: "2026-12", to: null });
  });
});

describe("a requirement and a plus on one line", () => {
  it("keeps Excel required when the line adds \"QuickBooks a plus\"", () => {
    const req = parseRequirements("Qualifications\n- Proficient in Excel; QuickBooks a plus\n- Strong communication skills");
    expect(req.required).toContain("Excel");
    expect(req.required).not.toContain("QuickBooks");
    expect(req.preferred).toContain("QuickBooks");
  });
});
