import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { Section, SectionHeading } from "./section";

const CHECKED = [
  { token: "40+", fact: "what you confirmed about vendor accounts" },
  { token: "$3,200", fact: "what you confirmed about duplicate payments" },
];

export function BulletWalkthrough() {
  return (
    <Section id="proof">
      <SectionHeading eyebrow="Proof, not guesses" title="Every line on your resume has proof behind it.">
        Recruiters ask about the numbers on your resume. Proofline only uses what you&apos;ve confirmed, in your words, so
        you&apos;ll always have the answer.
      </SectionHeading>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_auto_1.15fr_auto_1.15fr] lg:items-stretch">
        <Step n="01" title="You write what you did">
          <div className="rounded-lg border bg-background px-4 py-3 text-[14px] leading-6 shadow-xs">
            Reconciled vendor accounts in QuickBooks and caught duplicate payments
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-brand-ink">
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
            Saved exactly as you wrote it
          </p>
        </Step>

        <Connector />

        <Step n="02" title="The review asks for the number">
          <div className="rounded-lg border border-pending/50 bg-pending-soft p-3 text-[13px] leading-5 text-pending-ink">
            <p className="flex items-center gap-1.5 font-medium">
              <CircleAlert className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
              No number in this bullet
            </p>
            <p className="mt-1">How many accounts? How much did the duplicates add up to?</p>
          </div>
          <div className="mt-3 rounded-lg border bg-background p-3 text-[13.5px] leading-6">
            Reconciled 40+ vendor accounts a month in QuickBooks, catching $3,200 in duplicate payments
          </div>
          <p className="mt-2 text-[12.5px] text-muted-foreground">You edit the line. Saving the edit confirms it again.</p>
        </Step>

        <Connector />

        <Step n="03" title="Every number is checked">
          <div className="rounded-lg border bg-background p-4 shadow-xs">
            <p className="text-[15px] leading-7">
              <span className="font-semibold">Reconciled</span> 40+ vendor accounts a month in QuickBooks, catching $3,200 in
              duplicate payments.
            </p>
            <ul className="mt-3 space-y-1 border-t pt-3">
              {CHECKED.map((c) => (
                <li key={c.token} className="flex items-center gap-1.5 text-[12px] leading-5 text-muted-foreground">
                  <Check className="size-3 text-brand" strokeWidth={2.5} aria-hidden="true" />
                  <span className="font-medium text-foreground">{c.token}</span> matches {c.fact}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
            A number you never confirmed blocks the download, with the line quoted so you know exactly what to fix.
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
