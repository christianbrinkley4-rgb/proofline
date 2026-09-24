import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { Section, SectionHeading } from "./section";

const QUESTIONS = [
  { q: "How many vendor accounts do you reconcile each month?", a: "About 40" },
  { q: "How much were the double payments, roughly?", a: "$3,200" },
  { q: "Over what stretch of time?", a: "My first 3 months" },
];

const PICKED_UP = ["Bookkeeping, part-time", "Dental office", "Vendor payments", "Reconciliations", "QuickBooks"];

const FACTS = ["40+ accounts a month", "$3,200 in duplicates", "First quarter", "QuickBooks Online"];

export function BulletWalkthrough() {
  return (
    <Section id="proof">
      <SectionHeading eyebrow="Proof, not guesses" title="Every line on your resume has proof behind it.">
        Recruiters ask about the numbers on your resume. Proofline only writes what you&apos;ve confirmed, so you&apos;ll
        always have the answer.
      </SectionHeading>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_auto_1.15fr_auto_1.15fr] lg:items-stretch">
        <Step n="01" title="You say what you did">
          <div className="rounded-2xl rounded-tl-md bg-background px-4 py-3 text-[14px] leading-6 shadow-xs ring-1 ring-border">
            I do the books part-time for a dental office. Mostly paying vendors in QuickBooks and matching statements.
            Found some double payments once.
          </div>
          <div className="mt-5 text-[12px] text-subtle-foreground">What it picked up</div>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {PICKED_UP.map((item) => (
              <li key={item} className="rounded-md border bg-background px-2 py-0.5 text-[12px] leading-5">
                {item}
              </li>
            ))}
            <li className="inline-flex items-center gap-1 rounded-md border border-pending/50 bg-pending-soft px-1.5 py-0.5 text-[12px] leading-5 text-pending-ink">
              <CircleAlert className="size-3" strokeWidth={2.5} aria-hidden="true" />
              Double payments, no numbers yet
            </li>
          </ul>
        </Step>

        <Connector />

        <Step n="02" title="It asks for the details">
          <ul className="space-y-2">
            {QUESTIONS.map(({ q, a }) => (
              <li key={q} className="rounded-lg border bg-background p-3">
                <div className="text-[13px] text-muted-foreground">{q}</div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[14px] font-medium">{a}</span>
                  <Check className="size-3.5 text-brand" strokeWidth={3} aria-label="Confirmed" />
                </div>
              </li>
            ))}
          </ul>
        </Step>

        <Connector />

        <Step n="03" title="It writes the bullet">
          <div className="rounded-lg border bg-background p-4 shadow-xs">
            <p className="text-[15px] leading-7">
              <span className="font-semibold">Reconciled</span> 40+ vendor accounts each month in QuickBooks Online,
              catching $3,200 in duplicate payments within the first quarter.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
              {FACTS.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[12px] leading-5 text-muted-foreground"
                >
                  <Check className="size-3 text-brand" strokeWidth={2.5} aria-hidden="true" />
                  {f}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
            Strong verb first, then the result, then how. Anything you haven&apos;t confirmed stays flagged and never ends
            up in an export.
          </p>
        </Step>
      </div>
    </Section>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-muted/40 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="grid size-6 place-items-center rounded-full bg-ink font-mono text-[11px] text-ink-foreground">{n.replace(/^0/, "")}</span>
        <span className="font-medium">{title}</span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Connector() {
  return (
    <div aria-hidden="true" className="hidden items-center justify-center text-border-strong lg:flex">
      <ArrowRight className="size-4" />
    </div>
  );
}
