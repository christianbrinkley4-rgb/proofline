import { describe, expect, it } from "vitest";
import { scoreFit, type CandidateProfile } from "@/lib/fit/engine";
import { parseRequirements } from "@/lib/fit/requirements";
import { jobDocumentImprovementSteps } from "./coaching";

const person: CandidateProfile = {
  confirmedText: ["Built an Excel tracker for weekly inventory counts"],
  experienceTitles: ["Warehouse assistant"],
  hasInternship: false,
  major: null, minor: null, degree: null, gpa: null, gradDate: null,
  targetLocations: [], workModes: [], needsSponsorship: false, credentials: [],
};

describe("job document coaching", () => {
  const fit = scoreFit({
    title: "Inventory analyst", location: null, mode: "unknown", level: "entry",
    requirements: parseRequirements("Responsibilities\nMaintain inventory records.\nQualifications\nExcel required\nSQL required"),
  }, person);

  it("distinguishes a real skill gap from confirmed evidence omitted by a resume", () => {
    const steps = jobDocumentImprovementSteps({ jobId: "job-1", fit, resumeBullets: ["Maintained stock records"] });
    expect(steps[0]).toMatchObject({ id: "required-skill-gap", title: expect.stringContaining("SQL") });
    expect(steps[0].detail).toMatch(/keep it off this application until you can support the claim/);
    expect(steps[1]).toMatchObject({ id: "resume-evidence", title: expect.stringContaining("Excel") });
  });

  it("recommends a confirmed example omitted from a cover letter", () => {
    const steps = jobDocumentImprovementSteps({ jobId: "job-1", fit, letterEvidence: ["I maintained stock records."] });
    expect(steps).toContainEqual(expect.objectContaining({ id: "letter-evidence", href: "/app/jobs/job-1/packet#letter" }));
  });

  it("gives a concrete first step when a sparse profile produces no work examples", () => {
    const steps = jobDocumentImprovementSteps({
      jobId: "job-1",
      fit,
      resumeBullets: [],
      letterEvidence: [],
    });
    expect(steps).toContainEqual(expect.objectContaining({
      id: "resume-no-evidence",
      detail: expect.stringContaining("work or project example"),
    }));
    expect(steps).toContainEqual(expect.objectContaining({
      id: "letter-no-evidence",
      detail: expect.stringContaining("confirmed example"),
    }));
  });
  it("does not recommend adding a skill that is already shown", () => {
    const steps = jobDocumentImprovementSteps({ jobId: "job-1", fit, resumeBullets: ["Built an Excel tracker for weekly inventory counts"] });
    expect(steps.some((step) => step.id === "resume-evidence")).toBe(false);
  });
});
