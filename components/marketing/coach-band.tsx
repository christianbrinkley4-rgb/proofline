import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { container } from "./section";

const RAIL = [
  { label: "Your facts", state: "done" },
  { label: "Paste a job", state: "done" },
  { label: "Tailored resume", state: "done" },
  { label: "Close gaps", state: "current" },
] as const;

/** What the signed-in home screen looks like: a rail of six steps and exactly one thing to do. */
export function CoachBand() {
  return (
    <section className="relative overflow-hidden bg-ink text-ink-foreground grain">
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-25 atmosphere-soft" />
      <div className={`${container} relative grid gap-12 py-20 sm:py-28 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16`}>
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[12px] tracking-wide text-ink-muted uppercase">
            <span aria-hidden="true" className="h-px w-5 bg-brand" />
            Your coach
          </p>
          <h2 className="mt-4 font-display text-[34px] leading-[1.04] font-semibold sm:text-[46px]">
            Never wonder what to do next.
          </h2>
          <p className="mt-5 max-w-lg text-[17px] leading-7 text-ink-muted sm:text-[18px] sm:leading-8">
            Paste a job and Proofline shows where your resume stands against it and the single step that makes it
            stronger. Missing something they ask for? It asks where you&apos;ve done it, in your words, and rebuilds.
          </p>
          <ul className="mt-8 space-y-3 text-[15px]">
            {["One next step, with the reason behind it", "Nothing sent or submitted without you", "Numbers only come from you"].map((line) => (
              <li key={line} className="flex items-center gap-3">
                <span className="grid size-5 place-items-center rounded-full bg-brand/20 text-brand">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden="true" className="rounded-2xl bg-background p-5 text-foreground shadow-lift sm:p-7">
          <div className="text-[12px] font-medium text-subtle-foreground">Your resume for Whitfield &amp; Lowe</div>
          <ol className="mt-4 grid grid-cols-4 gap-1.5">
            {RAIL.map((step) => (
              <li key={step.label}>
                <span
                  className={cn(
                    "block h-1.5 rounded-full",
                    step.state === "done" ? "bg-brand" : step.state === "current" ? "bg-ink" : "bg-muted",
                  )}
                />
                <span className={cn("mt-2 block text-[11px] sm:text-[12px]", step.state === "current" ? "font-semibold" : "text-subtle-foreground")}>
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-6 rounded-xl border bg-muted/40 p-4 sm:p-5">
            <div className="text-[12px] font-medium text-brand-ink">Step 4 of 4</div>
            <div className="mt-1 font-display text-[22px] leading-tight font-semibold">The posting asks for journal entries. Have you done anything like it?</div>
            <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
              Answer in a sentence and confirm it. It becomes a fact in your own words. Haven&apos;t done it yet? Say so, and it won&apos;t ask again for this job.
            </p>
            <span className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[14px] font-medium text-primary-foreground">
              Confirm and rebuild
              <ArrowRight className="size-4" />
            </span>
          </div>
          <p className="mt-4 text-[12.5px] text-subtle-foreground">Your resume rebuilds with the new fact, and the review runs again.</p>
        </div>
      </div>
    </section>
  );
}
