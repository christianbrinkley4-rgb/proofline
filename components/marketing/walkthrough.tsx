import { ArrowUpRight, Check, CircleAlert, FileText, Mic, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, SectionHeading } from "./section";

/**
 * The loop the in-app coach walks every student through, in the same order:
 * Story, Find, Fit, Resume, Packet, Track. Each step shows a small slice of the real screen.
 */
const STEPS = [
  {
    id: "story",
    title: "Tell your story",
    text: "Upload a resume, talk it out, or type a few lines. Every claim becomes a fact you confirm.",
    visual: <StoryVisual />,
  },
  {
    id: "find",
    title: "Find roles worth your time",
    text: "Describe the job like you'd text a friend. It searches live employer boards and merges duplicates.",
    visual: <FindVisual />,
  },
  {
    id: "fit",
    title: "See how you fit",
    text: "A score out of 100 with the math shown: what you have, what's missing, and what to do about it.",
    visual: <FitVisual />,
  },
  {
    id: "resume",
    title: "Build the resume",
    text: "Three one-page versions for each job, written only from confirmed facts. Pick the one you can defend.",
    visual: <ResumeVisual />,
  },
  {
    id: "packet",
    title: "Finish the packet",
    text: "A cover letter from your evidence, plus the one part only you can write: why this job.",
    visual: <PacketVisual />,
  },
  {
    id: "track",
    title: "Apply and follow up",
    text: "You apply on the employer's site. It tracks the stage, reminds you when to follow up, and drafts the email.",
    visual: <TrackVisual />,
  },
];

export function Walkthrough() {
  return (
    <Section id="how" className="relative">
      <SectionHeading eyebrow="How it works" title="A coach for the whole search, one step at a time.">
        Most tools hand you a dashboard and wish you luck. Proofline walks you through each application in order, and
        always tells you the one thing to do next.
      </SectionHeading>

      <ol className="relative mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {STEPS.map((step, i) => (
          <li key={step.id} className="group flex min-w-0 flex-col rounded-2xl border bg-background p-2 transition-colors hover:border-border-strong">
            <div aria-hidden="true" className="relative flex h-44 items-center overflow-hidden rounded-xl atmosphere-soft bg-muted/60 p-4">
              {step.visual}
            </div>
            <div className="px-3 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-6 place-items-center rounded-full bg-ink font-mono text-[11px] text-ink-foreground tabular-nums">{i + 1}</span>
                <h3 className="text-[16.5px] font-semibold tracking-tight">{step.title}</h3>
              </div>
              <p className="mt-2 text-[14.5px] leading-6 text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("w-full rounded-lg border bg-background p-3 text-[12px] shadow-xs", className)}>{children}</div>;
}

function StoryVisual() {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-start gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground">
          <Mic className="size-3" />
        </span>
        <div className="rounded-2xl rounded-tl-md bg-background px-3 py-2 text-[12px] leading-5 ring-1 ring-border">
          I ran the front desk at a dental office and cut check-in time in half.
        </div>
      </div>
      <div className="ml-8 flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
        <span className="text-[12px]">Cut patient check-in time by 50%</span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-brand-ink">
          <Check className="size-3" strokeWidth={3} />
          Confirmed
        </span>
      </div>
    </div>
  );
}

function FindVisual() {
  return (
    <Card>
      <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-muted-foreground">
        <Search className="size-3" />
        business internships near Raleigh
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {[
          ["Business Operations Intern", "Carrow Partners", 84],
          ["Business Analyst Intern", "Brightline Health", 79],
          ["Rotational Program Intern", "Oakridge Credit Union", 71],
        ].map(([title, company, score]) => (
          <li key={title} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">
              <span className="font-medium">{title}</span> <span className="text-muted-foreground">· {company}</span>
            </span>
            <span className="font-semibold tabular-nums">{score}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FitVisual() {
  const rows = [
    ["Required skills", 27, 30],
    ["Experience", 21, 25],
    ["Education", 15, 15],
  ] as const;
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <span className="text-subtle-foreground">Audit Intern · Whitfield &amp; Lowe</span>
        <span className="font-display text-[20px] font-semibold tabular-nums">87</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map(([label, pts, max]) => (
          <div key={label}>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular-nums">
                {pts}/{max}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-muted">
              <div className="h-full origin-left rounded-full bg-brand motion-safe:animate-bar-grow" style={{ width: `${(pts / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ResumeVisual() {
  return (
    <div className="mx-auto w-44 rounded-md border bg-background p-3 shadow-xs">
      <div className="h-2 w-20 rounded bg-foreground/80" />
      <div className="mt-1 h-1 w-28 rounded bg-muted-foreground/30" />
      <div className="mt-3 space-y-1.5">
        <div className="h-1 w-full rounded bg-muted-foreground/25" />
        <div className="relative -mx-1 rounded bg-brand-soft px-1 py-1 ring-1 ring-brand/30">
          <div className="h-1 w-full rounded bg-brand/60" />
          <div className="mt-1 h-1 w-3/4 rounded bg-brand/60" />
        </div>
        <div className="h-1 w-5/6 rounded bg-muted-foreground/25" />
        <div className="h-1 w-full rounded bg-muted-foreground/25" />
        <div className="h-1 w-2/3 rounded bg-muted-foreground/25" />
      </div>
      <div className="mt-3 flex items-center gap-1 text-[10px] font-medium text-brand-ink">
        <FileText className="size-2.5" />
        From 2 confirmed facts
      </div>
    </div>
  );
}

function PacketVisual() {
  const items = [
    ["Resume attached", "done"],
    ["Cover letter drafted", "done"],
    ["Why you want this job", "you"],
  ] as const;
  return (
    <Card className="space-y-1.5">
      {items.map(([label, state]) => (
        <div
          key={label}
          className={cn(
            "flex items-center justify-between gap-2 rounded-md px-2 py-1.5",
            state === "you" ? "bg-pending-soft text-pending-ink ring-1 ring-pending/40" : "bg-muted/60",
          )}
        >
          <span className={state === "you" ? "font-medium" : ""}>{label}</span>
          {state === "done" ? <Check className="size-3.5 text-brand" strokeWidth={3} /> : <CircleAlert className="size-3.5" strokeWidth={2.5} />}
        </div>
      ))}
    </Card>
  );
}

function TrackVisual() {
  return (
    <div className="grid w-full grid-cols-3 gap-1.5 text-[11px]">
      {[
        ["Saved", []],
        ["Applied", ["Carrow Partners"]],
        ["Interview", ["Whitfield & Lowe"]],
      ].map(([stage, cards]) => (
        <div key={stage as string} className="rounded-lg bg-background/70 p-1.5 ring-1 ring-border">
          <div className="px-1 pb-1 text-subtle-foreground">{stage as string}</div>
          {(cards as string[]).map((c) => (
            <div key={c} className="rounded-md border bg-background p-1.5 shadow-xs">
              <div className="truncate font-medium">{c}</div>
              {stage === "Applied" && (
                <div className="mt-1 flex items-center gap-1 text-pending-ink">
                  <ArrowUpRight className="size-2.5" />
                  Follow up Thu
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
