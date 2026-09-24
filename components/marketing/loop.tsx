import { Section, SectionHeading } from "./section";

const STEPS: Array<{ title: string; text: string; soon?: boolean }> = [
  { title: "Profile", text: "Start with a resume, then add the work, projects, and wins that make you you." },
  { title: "Find", text: "Describe the job you want. It searches live company job boards for you." },
  { title: "Score", text: "Every opening gets a fit score out of 100, and you can see the math." },
  { title: "Tailor", text: "Compare three one-page versions for each job, built from confirmed facts." },
  { title: "Apply", text: "A packet per job: a cover letter and form answers built from your facts, plus the link and deadline." },
  { title: "Track", text: "Every application on one board, from saved to offer." },
  { title: "Follow up", text: "See when to follow up, edit a draft, and record what you sent." },
  { title: "Prep", text: "Likely interview questions for each job, paired with stories from your own experience." },
];

export function Loop() {
  return (
    <Section>
      <SectionHeading eyebrow="The whole loop" title="Other tools grade your resume. Proofline runs the whole search.">
        Each step feeds the next. Tell it something once and it shows up everywhere it should, from the fit score to the
        follow-up email.
      </SectionHeading>

      <ol className="mt-12 grid overflow-hidden rounded-xl border bg-border [gap:1px] sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="bg-background p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] text-subtle-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              {step.soon && (
                <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Soon</span>
              )}
            </div>
            <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{step.title}</h3>
            <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
