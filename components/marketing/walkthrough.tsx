import { Check, ClipboardPaste, FileText, MessagesSquare, Mic, PenLine, SquareKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, SectionHeading } from "./section";

/**
 * The loop the in-app coach walks every student through, in the same order:
 * your resume, paste a job, three resumes, close the gaps. Each step shows a small
 * slice of the real screen.
 */
const STEPS = [
  {
    id: "story",
    title: "Build your resume",
    text: "Upload an old resume, talk it out, or type a few lines. Every claim becomes a fact you confirm, and your first one-page resume comes from those.",
    visual: <StoryVisual />,
  },
  {
    id: "paste",
    title: "Paste any job",
    text: "A link from LinkedIn, Indeed, Handshake, or a company site, or the description itself. You get a fit score with the math shown.",
    visual: <PasteVisual />,
  },
  {
    id: "resumes",
    title: "Get three tailored resumes",
    text: "Experience-first, skills-first, and keyword-matched, each one page. It tells you which one shows the most of what they ask for.",
    visual: <TrioVisual />,
  },
  {
    id: "gaps",
    title: "Close the gaps",
    text: "For each thing the posting wants that your resume doesn't show, it asks where you've done it. Your answer becomes a bullet, and the resumes rebuild.",
    visual: <GapVisual />,
  },
];

const THEN = [
  { icon: PenLine, title: "Cover letter", text: "Drafted from the same confirmed facts, with a spot for why you want the job." },
  { icon: SquareKanban, title: "Track and follow up", text: "Every application in one place, with reminders and follow-up drafts." },
  { icon: MessagesSquare, title: "Interview prep", text: "Likely questions paired with stories you already have." },
];

export function Walkthrough() {
  return (
    <Section id="how" className="relative">
      <SectionHeading eyebrow="How it works" title="The best resume for every job you want.">
        Most resume tools grade what you already wrote. Proofline builds each version from what you&apos;ve actually done,
        shows you what&apos;s missing for this job, and helps you close the gap honestly.
      </SectionHeading>

      <ol className="relative mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
        {STEPS.map((step, i) => (
          <li key={step.id} className="group flex min-w-0 flex-col rounded-2xl border bg-background p-2 transition-colors hover:border-border-strong">
            <div aria-hidden="true" className="relative flex h-48 items-center overflow-hidden rounded-xl atmosphere-soft bg-muted/60 p-4 sm:p-5">
              {step.visual}
            </div>
            <div className="px-3 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-6 place-items-center rounded-full bg-ink font-mono text-[11px] text-ink-foreground tabular-nums">{i + 1}</span>
                <h3 className="text-[17px] font-semibold tracking-tight">{step.title}</h3>
              </div>
              <p className="mt-2 text-[14.5px] leading-6 text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-2xl border bg-muted/30 p-5 sm:p-6">
        <p className="text-[13px] font-medium text-muted-foreground">Then, when your resume is right</p>
        <ul className="mt-3 grid gap-4 sm:grid-cols-3">
          {THEN.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background ring-1 ring-border">
                <Icon className="size-4 text-muted-foreground" />
              </span>
              <span>
                <span className="block text-[14px] font-semibold">{title}</span>
                <span className="block text-[13px] leading-5 text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
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

function PasteVisual() {
  const rows = [
    ["Required skills", 20, 30],
    ["Experience", 24, 25],
  ] as const;
  return (
    <Card>
      <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-muted-foreground">
        <ClipboardPaste className="size-3 shrink-0" />
        <span className="truncate">linkedin.com/jobs/view/staff-accountant-intern</span>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between">
        <span className="min-w-0 truncate">
          <span className="font-medium">Staff Accountant Intern</span> <span className="text-muted-foreground">· Whitfield &amp; Lowe</span>
        </span>
        <span className="font-display text-[20px] font-semibold tabular-nums">80</span>
      </div>
      <div className="mt-1.5 space-y-1.5">
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

function TrioVisual() {
  const versions = [
    ["Experience first", "5/6", true],
    ["Skills first", "4/6", false],
    ["Keyword match", "4/6", false],
  ] as const;
  return (
    <div className="grid w-full grid-cols-3 gap-2">
      {versions.map(([label, shown, best]) => (
        <div key={label} className={cn("min-w-0 rounded-md border bg-background p-2 shadow-xs", best && "border-brand/50 ring-1 ring-brand/30")}>
          <div className="h-1.5 w-2/3 rounded bg-foreground/70" />
          <div className="mt-2 space-y-1">
            <div className={cn("h-1 rounded", best ? "bg-brand/60" : "bg-muted-foreground/25")} />
            <div className="h-1 w-5/6 rounded bg-muted-foreground/25" />
            <div className="h-1 rounded bg-muted-foreground/25" />
            <div className="h-1 w-2/3 rounded bg-muted-foreground/25" />
          </div>
          <p className="mt-2 truncate text-[10.5px] font-medium">{label}</p>
          <p className={cn("flex items-center gap-1 text-[10px]", best ? "text-brand-ink" : "text-subtle-foreground")}>
            {best ? <Check className="size-2.5" strokeWidth={3} /> : <FileText className="size-2.5" />}
            {shown} shown
          </p>
        </div>
      ))}
    </div>
  );
}

function GapVisual() {
  return (
    <div className="w-full space-y-2">
      <Card className="space-y-1.5">
        <span className="inline-block rounded bg-pending-soft px-1.5 py-0.5 text-[10.5px] font-medium text-pending-ink">Required</span>
        <p className="font-medium">They require journal entries. Where have you used it?</p>
        <p className="rounded-md bg-muted/70 px-2 py-1.5 text-muted-foreground">Recorded journal entries in QuickBooks for 40 vendor accounts at month-end.</p>
      </Card>
      <div className="flex items-center justify-between rounded-lg border border-brand/30 bg-brand-soft/70 px-3 py-2 text-[12px]">
        <span className="flex items-center gap-1.5 font-medium">
          <Check className="size-3.5 text-brand-ink" strokeWidth={3} />
          New bullet added
        </span>
        <span className="font-medium text-brand-ink tabular-nums">Fit 80 → 86</span>
      </div>
    </div>
  );
}
