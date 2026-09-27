export type CareerMeasure = {
  confirmedFacts: number;
  activeBullets: number;
  relevantBullets: number;
  matchedRequired: number | null;
  totalRequired: number | null;
};

export type CareerAction = { id: string; title: string; detail: string; href: string };

/** A practical plan from observed profile evidence and one real benchmark posting. */
export function careerActions(input: {
  targetRole: string;
  measure: CareerMeasure;
  hasBenchmark: boolean;
  missingRequired: string[];
  matchedRequired: string[];
  completedActionIds?: ReadonlySet<string>;
  benchmarkJobId?: string | null;
  hasTailoredResume?: boolean;
}): CareerAction[] {
  const { targetRole, measure, hasBenchmark, missingRequired, matchedRequired } = input;
  const actions: CareerAction[] = [];
  if (targetRole === "Explore career directions") {
    return [
      {
        id: "notice-patterns",
        title: "Notice when you feel engaged",
        detail: "Write down three real moments from work, school, home, or volunteering when you felt useful or curious. Note the task, people, and setting. You are collecting clues, not choosing a career yet.",
        href: "/app/profile",
      },
      {
        id: "compare-directions",
        title: "Explore three different kinds of work",
        detail: "Look at real postings in different fields. For each, mark what sounds energizing, what sounds draining, and which requirements would take time to build.",
        href: "/app/jobs",
      },
      {
        id: "small-experiment",
        title: "Try one small experiment",
        detail: "Pick a low-cost trial: a short project, volunteer shift, introductory class, or conversation with someone doing the work. Record what you actually learned on your profile.",
        href: "/app/profile",
      },
      {
        id: "choose-next-direction",
        title: "Choose a direction to test next",
        detail: "After an experiment, name one role or life direction to investigate for a month. The choice can change as you learn more.",
        href: "/app/career",
      },
    ].filter((action) => !input.completedActionIds?.has(action.id));
  }
  if (measure.confirmedFacts === 0) {
    actions.push({
      id: "first-evidence",
      title: "Record one real example",
      detail: `Describe a task from work, class, a project, or volunteering that could matter for ${targetRole}. Say what you did and how. Proofline will ask before using it as a claim.`,
      href: "/app/profile",
    });
  }
  if (measure.activeBullets === 0) {
    actions.push({
      id: "first-bullet",
      title: "Turn that example into a resume bullet",
      detail: "Review the suggested wording on your profile. Accept only a sentence you can explain in an interview.",
      href: "/app/profile",
    });
  }
  if (!hasBenchmark) {
    actions.push({
      id: "benchmark",
      title: "Choose a real posting to benchmark this goal",
      detail: `Save a ${targetRole} posting with its full description. The plan can then identify the requirements your profile shows and the ones it does not yet show.`,
      href: "/app/jobs",
    });
  }
  for (const skill of missingRequired.slice(0, 2)) {
    actions.push({
      id: `gap:${skill}`,
      title: `Check your experience with ${skill}`,
      detail: `The benchmark posting requires ${skill}, but your confirmed profile does not show it. If you have used it, add a specific example. Otherwise, practice it in a small project or course before claiming it.`,
      href: "/app/profile",
    });
  }
  if (hasBenchmark && measure.activeBullets > 0 && measure.relevantBullets === 0) {
    const skill = matchedRequired[0];
    actions.push({
      id: "role-evidence",
      title: "Make your strongest example visible",
      detail: skill
        ? `Your profile shows ${skill}, but no active bullet clearly connects to the benchmark posting. Add a truthful example of how you used it, then tailor a resume for that job.`
        : "Review your active bullets against the posting. Add a truthful example that connects your work to a stated responsibility, then tailor a resume.",
      href: "/app/profile",
    });
  }
  if (hasBenchmark && measure.relevantBullets > 0) {
    actions.push({
      id: "tailor",
      title: input.hasTailoredResume ? "Review your application for this posting" : "Build a resume for this posting",
      detail: input.hasTailoredResume
        ? "Your job-specific resume exists. Review it against the posting, then check the cover letter and any new evidence before applying."
        : "Use the confirmed examples that match the description. Review the generated resume and letter before applying.",
      href: input.hasTailoredResume && input.benchmarkJobId ? `/app/jobs/${input.benchmarkJobId}` : "/app/resumes/new",
    });
  }
  return actions.slice(0, 4);
}
