import Link from "next/link";
import { Check, CircleHelp, OctagonX } from "lucide-react";
import type { Knockout } from "@/lib/fit/knockouts";
import { cn } from "@/lib/utils";

/**
 * The must-haves (graduation window, work authorization, location, start date),
 * first on the page and separate from the score. When all of them are fine it's
 * one line; the details open only when something needs a look.
 */
export function KnockoutPanel({ knockouts, jobId }: { knockouts: Knockout[]; jobId: string }) {
  const out = knockouts.filter((k) => k.status === "knockout");
  const unknown = knockouts.filter((k) => k.status === "unknown");
  const list = (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {knockouts.map((k) => (
        <li key={k.key} className="flex gap-2.5 rounded-lg bg-background/70 p-2.5 text-[13px] leading-5">
          {k.status === "ok" ? (
            <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} />
          ) : k.status === "knockout" ? (
            <OctagonX className="mt-0.5 size-4 shrink-0 text-destructive" />
          ) : (
            <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <span>
            <span className="font-medium">{k.label}.</span> <span className="text-muted-foreground">{k.reason}</span>
            {k.status === "unknown" && k.fix && (
              <Link href={`/app/onboarding?step=${k.fix}&back=${encodeURIComponent(`/app/jobs/${jobId}`)}`} className="ml-1 font-medium whitespace-nowrap underline-offset-2 hover:underline">
                Add it
              </Link>
            )}
          </span>
        </li>
      ))}
    </ul>
  );

  if (!out.length) {
    return (
      <details className="group rounded-2xl border bg-background">
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-2.5 text-[14px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <Check className="size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden="true" />
          <span className="font-medium">{unknown.length ? "No dealbreakers found" : "You meet the must-haves"}</span>
          <span className="text-[13px] text-muted-foreground">
            {unknown.length === 1 ? "One thing I couldn't check yet. " : unknown.length ? `${unknown.length} things I couldn't check yet. ` : ""}
            <span className="underline-offset-2 group-open:hidden hover:underline">Show</span>
          </span>
        </summary>
        <div className="border-t px-4 pb-4">{list}</div>
      </details>
    );
  }

  return (
    <section aria-labelledby="knockouts-heading" className={cn("rounded-2xl border border-destructive/40 bg-destructive/5 p-4 sm:p-5")}>
      <h2 id="knockouts-heading" className="text-[15px] font-semibold">
        This job has a dealbreaker for you
      </h2>
      <p className="mt-1 text-[14px] leading-6">
        {out.map((k) => k.reason).join(" ")} A resume won&apos;t change that, so I won&apos;t make one for this job. Your fit is below only so you can see how the rest lines up.
      </p>
      {list}
    </section>
  );
}
