import Link from "next/link";
import { Check, CircleHelp, OctagonX } from "lucide-react";
import type { Knockout } from "@/lib/fit/knockouts";
import { cn } from "@/lib/utils";

/** The four knockouts, first on the page and separate from the score. */
export function KnockoutPanel({ knockouts, jobId }: { knockouts: Knockout[]; jobId: string }) {
  const out = knockouts.filter((k) => k.status === "knockout");
  return (
    <section aria-labelledby="knockouts-heading" className={cn("rounded-2xl border p-4 sm:p-5", out.length ? "border-destructive/40 bg-destructive/5" : "bg-background")}>
      <h2 id="knockouts-heading" className="text-[15px] font-semibold">
        {out.length ? "Knockout: don't tailor for this job" : "Knockouts: none found"}
      </h2>
      {out.length > 0 && (
        <p className="mt-1 text-[14px] leading-6">
          {out.map((k) => k.reason).join(" ")} A tailored resume won&apos;t change that, so tailoring is off for this job. Your score is below only so you can see how the rest lines up.
        </p>
      )}
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
    </section>
  );
}
