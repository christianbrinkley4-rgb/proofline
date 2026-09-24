import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { Section, SectionHeading } from "./section";

const STUDENT_FEATURES = [
  "Job search across live company job boards",
  "Watched searches that surface new matches daily",
  "Fit scores with the full breakdown",
  "Three tailored resume strategies per job, with PDF and DOCX export",
  "Cover letters and form answers built only from facts you confirm",
  "Interview prep with stories from your own experience",
  "Application tracker with notes, reminders, and follow-up drafts",
  "A personal agent, or bring your own AI with the same rules",
];

const CAREER_CENTER_FEATURES = [
  "Seats for your whole program",
  "Outcome reporting by major and class year",
  "Job lists from the employers you already work with",
  "Student data stays with the student",
];

export function Pricing() {
  return (
    <Section id="pricing">
      <SectionHeading eyebrow="Pricing" title="Free while we're in beta.">
        We&apos;d rather you get hired than get billed. When paid plans start, you&apos;ll hear from us at least 30 days
        ahead, and everything you built stays exportable.
      </SectionHeading>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative isolate flex flex-col overflow-hidden rounded-2xl border bg-background p-6 shadow-lift sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 atmosphere-soft opacity-70" />
          <div className="relative flex items-center justify-between">
            <h3 className="text-[15px] font-semibold">Students and recent grads</h3>
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-medium text-brand-ink">Beta</span>
          </div>
          <div className="relative mt-6 flex items-baseline gap-2">
            <span className="font-display text-[56px] leading-none font-semibold">$0</span>
            <span className="text-[14px] text-muted-foreground">during beta</span>
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">You do not need to be in college to sign up.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {STUDENT_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5 text-[14px] leading-6">
                <Check className="mt-1 size-4 shrink-0 text-brand" strokeWidth={2.5} />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-8">
            <Button size="xl" asChild>
              <Link href={site.routes.signUp}>
                Start free
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>

        <div id="career-centers" className="flex flex-col rounded-2xl border bg-muted/50 p-6 sm:p-8">
          <h3 className="text-[15px] font-semibold">Career centers</h3>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-[56px] leading-none font-semibold">Custom</span>
          </div>
          <p className="mt-4 text-[14px] leading-6 text-muted-foreground">
            Give every student the full toolkit, and see applications, interviews, and offers across your cohort instead
            of resume downloads. We&apos;re building this with pilot schools now.
          </p>
          <ul className="mt-6 space-y-3">
            {CAREER_CENTER_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5 text-[14px] leading-6">
                <Check className="mt-1 size-4 shrink-0 text-muted-foreground" strokeWidth={2.5} />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-8">
            <Button size="xl" variant="outline" asChild className="bg-background">
              <a href={`mailto:${site.contactEmail}?subject=${encodeURIComponent(`${site.name} for our career center`)}`}>
                Talk to us
              </a>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
