import { DEMO_CANDIDATE, DEMO_EXPERIENCE, DEMO_LEADERSHIP } from "@/lib/demo/sample-data";
import type { ResumeDocument } from "../document";

/** The landing-page sample student as a resume document. Used by tests and the dev preview route. */
export const SAMPLE_RESUME: ResumeDocument = {
  header: { name: DEMO_CANDIDATE.name, contact: ["Raleigh, NC", "jordan@example.com", "(919) 555-0142", "linkedin.com/in/jordan-example"] },
  sections: [
    {
      kind: "education",
      title: "Education",
      entries: [
        {
          school: DEMO_CANDIDATE.school,
          location: "Raleigh, NC",
          degreeLine: "Bachelor of Science in Accounting",
          gradLine: DEMO_CANDIDATE.grad,
          details: ["GPA: 3.6/4.0", `Relevant coursework: ${DEMO_CANDIDATE.coursework}`],
        },
      ],
    },
    {
      kind: "entries",
      title: "Experience",
      entries: DEMO_EXPERIENCE.map((r, i) => ({
        experienceId: `e${i}`,
        org: r.org,
        title: r.title,
        location: "Raleigh, NC",
        dates: r.dates,
        bullets: r.bullets.map((b) => ({ id: b.id, text: b.text, factIds: [`f-${b.id}`] })),
      })),
    },
    {
      kind: "entries",
      title: "Leadership and Activities",
      entries: [
        {
          experienceId: "lead",
          org: DEMO_LEADERSHIP.org,
          title: DEMO_LEADERSHIP.title,
          location: null,
          dates: DEMO_LEADERSHIP.dates,
          bullets: DEMO_LEADERSHIP.bullets.map((b) => ({ id: b.id, text: b.text, factIds: [`f-${b.id}`] })),
        },
      ],
    },
    { kind: "skills", title: "Skills", lines: [{ label: "Technical", items: DEMO_CANDIDATE.skills.split(", ") }] },
  ],
};
