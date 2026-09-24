import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CoachAction, Journey } from "@/lib/agent/coach";
import { cn } from "@/lib/utils";

/**
 * The coach card: six steps of one application and the single thing to do now.
 * Everything else on the page is secondary to this.
 */
export function JourneyRail({ journey, action, title }: { journey: Journey; action?: CoachAction; title?: string }) {
  const next = action ?? journey.action;
  const done = journey.current === "done";
  const heading =
    title ?? (journey.focus ? `${done ? "Sent" : "Your application"} · ${journey.focus.company}` : "Your first application");

  return (
    <section aria-labelledby="coach-heading" className="relative isolate overflow-hidden rounded-2xl border bg-background shadow-lift">
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-80 atmosphere-soft" />
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p id="coach-heading" className="text-[12.5px] font-medium text-muted-foreground">
            {heading}
          </p>
          {journey.focus && <p className="max-w-[60%] truncate text-[12px] text-subtle-foreground">{journey.focus.title}</p>}
        </div>

        <ol aria-label="Application steps" className="mt-4 grid grid-cols-6 gap-1.5 sm:gap-2">
          {journey.steps.map((step, i) => (
            <li key={step.id} aria-current={step.state === "current" ? "step" : undefined}>
              <span className="block h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
                {step.state !== "upcoming" && (
                  <span
                    className={cn(
                      "block h-full origin-left rounded-full motion-safe:animate-bar-grow",
                      step.state === "done" ? "bg-brand" : "w-1/2 bg-ink",
                    )}
                    style={{ animationDelay: `${i * 90}ms` }}
                  />
                )}
              </span>
              <span
                className={cn(
                  "mt-2 flex items-center gap-1 text-[11px] sm:text-[12.5px]",
                  step.state === "current" ? "font-semibold text-foreground" : step.state === "done" ? "text-brand-ink" : "text-subtle-foreground",
                )}
              >
                {step.state === "done" && <Check className="hidden size-3 sm:block" strokeWidth={3} />}
                {step.label}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl motion-safe:animate-rise">
            <p className="text-[12px] font-medium text-brand-ink">{done ? "Loop complete" : `Step ${journey.position} of ${journey.steps.length}`}</p>
            <h2 className="mt-1 font-display text-[24px] leading-[1.1] font-semibold sm:text-[30px]">{next.title}</h2>
            <p className="mt-2 text-[14.5px] leading-6 text-pretty text-muted-foreground">{next.detail}</p>
          </div>
          <Button size="xl" asChild className="shrink-0 motion-safe:animate-rise motion-safe:[animation-delay:120ms]">
            <Link href={next.href}>
              {next.cta}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
