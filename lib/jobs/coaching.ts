import type { FitReport } from "@/lib/fit/engine";
import { extractSkills } from "@/lib/fit/skills";

export type JobCoachingStep = { id: string; title: string; detail: string; href: string };

/** Document advice tied to a real posting and confirmed fit evidence. */
export function jobDocumentImprovementSteps(input: {
  jobId: string;
  fit: FitReport;
  resumeBullets?: string[];
  letterEvidence?: string[];
}): JobCoachingStep[] {
  const { jobId, fit, resumeBullets, letterEvidence } = input;
  const steps: JobCoachingStep[] = [];
  const required = fit.details.requiredSkills;
  const missing = required.missing[0];
  if (missing) {
    steps.push({
      id: "required-skill-gap",
      title: `Address ${missing} for this job`,
      detail: `The posting requires ${missing}, and your confirmed profile does not show it. If you have done this work, add a specific example. Otherwise, practice it and keep it off this application until you can support the claim.`,
      href: "/app/profile",
    });
  }

  if (resumeBullets?.length === 0) {
    const match = required.matched[0]?.split(" or ")[0];
    steps.push({
      id: "resume-no-evidence",
      title: "Add a confirmed example before using this resume",
      detail: match
        ? `Your profile supports ${match}, but this resume has no work or project example showing it. Add what you did with ${match}, where you did it, and a result you can explain. A class project or volunteer task counts if it is real.`
        : "This resume has no confirmed work or project examples for the posting. Add one real task from work, school, volunteering, or a project, including what you did and how you did it.",
      href: "/app/profile",
    });
  }

  if (resumeBullets?.length) {
    const shown = new Set(extractSkills(resumeBullets.join(" ")));
    const match = required.matched.flatMap((group) => group.split(" or ")).find((skill) => !shown.has(skill));
    if (match) {
      steps.push({
        id: "resume-evidence",
        title: `Show ${match} in this resume's work examples`,
        detail: `The posting asks for ${match} and your confirmed profile supports it, but the selected bullets do not show it. Add or select a truthful example of how you used it.`,
        href: "/app/profile",
      });
    }
  }

  if (letterEvidence?.length === 0) {
    steps.push({
      id: "letter-no-evidence",
      title: "Give the letter one specific proof point",
      detail: "The letter has no confirmed example connected to this posting. Add a true task or project to My experience, then use it to explain why you fit this role.",
      href: "/app/profile",
    });
  }

  if (letterEvidence?.length) {
    const shown = new Set(extractSkills(letterEvidence.join(" ")));
    const match = required.matched.flatMap((group) => group.split(" or ")).find((skill) => !shown.has(skill));
    if (match) {
      steps.push({
        id: "letter-evidence",
        title: `Connect your ${match} work to the letter`,
        detail: `The posting asks for ${match} and your confirmed profile supports it. Select a concrete ${match} example for the letter, then check that the wording stays true to your experience.`,
        href: `/app/jobs/${jobId}/packet#letter`,
      });
    }
  }

  if (!steps.length && fit.nextSteps.length) {
    steps.push({ id: "fit-next-step", title: "Check this posting's remaining gap", detail: fit.nextSteps[0], href: "/app/profile" });
  }
  if (!steps.length) {
    steps.push({
      id: "verify-role-evidence",
      title: "Check your strongest example against this posting",
      detail: "Keep only details you can explain in an interview. If you know a real outcome or scale, add it to the matching work example; do not estimate a number you cannot support.",
      href: "/app/profile",
    });
  }
  return steps.slice(0, 3);
}
