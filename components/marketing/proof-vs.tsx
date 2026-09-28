import { Check, X } from "lucide-react";
import { Section, SectionHeading } from "./section";

/**
 * How Proofline differs from the usual tools, stated as behavior, not brand names.
 * Every row here must stay true of the product (see docs/research/COMPETITORS.md).
 */
const ROWS: { question: string; typical: string; proofline: string }[] = [
  {
    question: "Asked for a stronger bullet",
    typical: "Adds a number that sounds good, like \"boosted engagement 40%\".",
    proofline: "Asks you for the real number, then checks it against what you confirmed.",
  },
  {
    question: "A skill the job wants that you haven't shown",
    typical: "Drops the keyword onto the page.",
    proofline: "Asks whether you've done it. Your answer, in your words, becomes the line.",
  },
  {
    question: "Getting it to employers",
    typical: "Sends hundreds of applications for you.",
    proofline: "You apply yourself, to the jobs worth it, with a page you can stand behind.",
  },
  {
    question: "What it costs",
    typical: "$29 to $50 a month, often billed weekly.",
    proofline: "Free during the private beta.",
  },
];

export function ProofVs() {
  return (
    <Section id="different" className="bg-muted/40">
      <SectionHeading eyebrow="Why it's different" title="Recruiters can't tell what's true anymore. You can show them.">
        AI tools made resumes longer and applications faster, and hiring teams now say skills are harder to verify than
        ever. Proofline goes the other way: fewer, stronger applications where every line holds up.
      </SectionHeading>

      <div className="mt-12 overflow-hidden rounded-2xl border bg-background">
        <div className="hidden grid-cols-[1fr_1.2fr_1.2fr] gap-6 border-b bg-muted/50 px-5 py-3 text-[12.5px] font-medium text-subtle-foreground sm:grid">
          <span>When it comes to</span>
          <span>Typical AI resume and auto-apply tools</span>
          <span className="text-brand-ink">Proofline</span>
        </div>
        <ul className="divide-y">
          {ROWS.map((row) => (
            <li key={row.question} className="grid gap-3 px-5 py-5 sm:grid-cols-[1fr_1.2fr_1.2fr] sm:gap-6">
              <p className="text-[15px] font-medium">{row.question}</p>
              <p className="flex min-w-0 items-start gap-2 text-[14.5px] leading-6 text-muted-foreground">
                <X className="mt-1 size-3.5 shrink-0 text-subtle-foreground" strokeWidth={2.5} aria-hidden="true" />
                <span>
                  <span className="sr-only sm:hidden">Typical tools: </span>
                  {row.typical}
                </span>
              </p>
              <p className="flex min-w-0 items-start gap-2 text-[14.5px] leading-6">
                <Check className="mt-1 size-3.5 shrink-0 text-brand" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="sr-only sm:hidden">Proofline: </span>
                  {row.proofline}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
