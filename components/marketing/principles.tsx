import { Bell, Check, CircleAlert } from "lucide-react";
import { Section, SectionHeading } from "./section";

export function Principles() {
  return (
    <Section id="why">
      <SectionHeading eyebrow="Why Proofline" title="Real jobs, honest scores, and a resume you can defend." />

      <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        <Principle
          title="It finds the jobs"
          text="Describe what you want the way you'd text a friend. Proofline searches live company job boards, merges duplicates, ranks what it finds by fit, and keeps watching after you log off."
        >
          <AlertVisual />
        </Principle>
        <Principle
          title="It never makes things up"
          text="Every line on your resume traces back to something you told it and confirmed. When a bullet needs a number you haven't given, it asks. It doesn't guess."
        >
          <FactsVisual />
        </Principle>
        <Principle
          title="It shows its work"
          text="Every fit score comes with the breakdown. Every resume comes with notes on why each bullet made the cut and what got left out."
        >
          <BreakdownVisual />
        </Principle>
      </div>
    </Section>
  );
}

function Principle({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div>
      <div aria-hidden="true" className="flex h-44 items-center rounded-xl border bg-muted/60 p-4 sm:p-5">
        {children}
      </div>
      <h3 className="mt-6 text-[17px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[15px] leading-7 text-muted-foreground">{text}</p>
    </div>
  );
}

function AlertVisual() {
  return (
    <div className="w-full rounded-lg border bg-background p-3 shadow-xs">
      <div className="flex items-center justify-between text-[11.5px] text-subtle-foreground">
        <span className="flex items-center gap-1.5">
          <Bell className="size-3" />
          Saved search
        </span>
        <span>7:02 AM</span>
      </div>
      <div className="mt-1 text-[13px] font-medium">3 new tax internships near Raleigh</div>
      <ul className="mt-2.5 space-y-1.5 text-[12px]">
        {[
          ["Tax Intern · Marlowe & Tate CPAs", 84],
          ["Tax Associate Intern · Carrow Partners", 81],
          ["Tax Intern · Hollins Group", 72],
        ].map(([label, score]) => (
          <li key={label} className="flex items-center justify-between gap-3">
            <span className="truncate text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FactsVisual() {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 shadow-xs">
        <span className="text-[12.5px]">Caught $3,200 in duplicate payments</span>
        <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-brand-ink">
          <Check className="size-3" strokeWidth={3} />
          Confirmed
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-pending/50 bg-pending-soft px-3 py-2.5">
        <span className="text-[12.5px]">Saved about 3 hours a week</span>
        <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-pending-ink">
          <CircleAlert className="size-3" strokeWidth={2.5} />
          Asking you
        </span>
      </div>
      <div className="flex gap-1.5 pl-1">
        <span className="rounded-md bg-foreground px-2 py-0.5 text-[11.5px] font-medium text-background">Yes</span>
        <span className="rounded-md border bg-background px-2 py-0.5 text-[11.5px]">No</span>
        <span className="rounded-md px-2 py-0.5 text-[11.5px] text-muted-foreground">Edit</span>
      </div>
    </div>
  );
}

function BreakdownVisual() {
  const rows = [
    ["Required skills", 27, 30],
    ["Experience", 21, 25],
    ["Education", 15, 15],
  ] as const;
  return (
    <div className="w-full rounded-lg border bg-background p-3 shadow-xs">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-subtle-foreground">Audit Intern · Whitfield & Lowe</span>
        <span className="text-[18px] font-semibold tabular-nums">87</span>
      </div>
      <div className="mt-2 space-y-2">
        {rows.map(([label, pts, max]) => (
          <div key={label}>
            <div className="flex justify-between text-[11.5px]">
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular-nums">
                {pts}/{max}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: `${(pts / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
