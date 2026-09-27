"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Download, FileText, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { createVariantsAction } from "@/app/app/resumes/compare/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TrioResume = {
  id: string;
  label: string;
  blurb: string;
  version: number;
  /** Required skills this page visibly shows, of the posting's total. */
  covered: number;
  total: number;
  checksOk: boolean;
  /** Quality checks passed, of the total, and the first one to fix. */
  passed: number;
  totalChecks: number;
  fixFirst: string | null;
  top: string[];
};

const STEPS = ["Reading what the posting asks for", "Ranking your confirmed bullets against it", "Fitting the best ones on one page, three ways", "Checking every line against your facts"];

/**
 * The three tailored versions for one job, the best one called out with its reason.
 * Builds them on arrival from the paste box, and offers a rebuild when the student
 * has added evidence since.
 */
export function ResumeTrio({ jobId, resumes, bestId, stale, autoBuild, blocked, limitedEvidence, hiddenStrategies = [] }: { jobId: string; resumes: TrioResume[]; bestId: string | null; stale: boolean; autoBuild: boolean; blocked: string | null; limitedEvidence: boolean; hiddenStrategies?: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const started = useRef(false);

  const build = () => {
    setError("");
    setStep(0);
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);
    startTransition(async () => {
      try {
        const result = await createVariantsAction(jobId);
        if (!result.ok) setError(result.error);
        // Don't rebuild just because the page reloads. Drop ?build=1 through the router
        // rather than history.replaceState: changing the URL under an in-flight refresh
        // left this card on "Building" forever.
        const url = new URL(window.location.href);
        if (url.searchParams.has("build")) {
          url.searchParams.delete("build");
          router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
        } else {
          router.refresh();
        }
      } catch {
        setError("Couldn't build the versions. Try again.");
      } finally {
        clearInterval(ticker);
      }
    });
  };

  useEffect(() => {
    if (!autoBuild || started.current || resumes.length || blocked) return;
    started.current = true;
    build();
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (blocked && !resumes.length) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-[14px] leading-6">
        <p>{blocked}</p>
        <Button asChild className="mt-4">
          <Link href="/app/profile#start">Add to your story</Link>
        </Button>
      </div>
    );
  }

  if (pending || (!resumes.length && autoBuild && !error)) {
    return (
      <div className="rounded-2xl border bg-background p-6">
        <p role="status" className="flex items-center gap-2 text-[15px] font-medium">
          <LoaderCircle className="size-4 animate-spin text-brand" />
          Building your three resumes
        </p>
        <ol className="mt-4 space-y-2.5">
          {STEPS.map((label, i) => (
            <li key={label} className={cn("flex items-center gap-2.5 text-[14px] transition-colors", i <= step ? "text-foreground" : "text-subtle-foreground")}>
              <span className={cn("size-1.5 rounded-full", i < step ? "bg-brand" : i === step ? "animate-pulse bg-brand" : "bg-border-strong")} />
              {label}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (!resumes.length) {
    return (
      <div className="rounded-2xl border border-dashed p-6">
        <p className="text-[15px] font-medium">Three one-page versions, each built only from your confirmed facts.</p>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Experience-first, skills-first, and keyword-matched. I&apos;ll tell you which one fits this posting best.</p>
        <Button size="lg" className="mt-4" onClick={build}>
          <Sparkles data-icon="inline-start" />
          Build my three resumes
        </Button>
        {error && <p role="alert" className="mt-3 text-[13px] text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {stale && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-soft/60 px-4 py-3 motion-safe:animate-view-in">
          <p className="text-[13.5px]">
            <span className="font-medium">You&apos;ve added evidence since these were built.</span> Rebuild so your new answers make it onto the page.
          </p>
          <Button size="sm" onClick={build}>
            <RefreshCw data-icon="inline-start" />
            Rebuild all three
          </Button>
        </div>
      )}
      {hiddenStrategies.length > 0 && (
        <div className="mb-3 rounded-xl border border-brand/25 bg-brand-soft/40 px-4 py-3 text-[13px] leading-5">
          <p className="font-medium">{resumes.length === 1 ? "One evidence selection is ready from your current profile." : `${resumes.length} distinct evidence selections are ready.`}</p>
          <p className="mt-0.5 text-muted-foreground">
            {hiddenStrategies.join(" and ")} use the same examples with a different layout or skills order. Compare the layouts, or add another real example and rebuild to get a different selection.
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4"><Link href={`/app/resumes/compare?job=${jobId}`} className="inline-flex min-h-8 items-center font-medium text-brand-ink underline underline-offset-2">Compare layouts</Link><Link href="/app/profile" className="inline-flex min-h-8 items-center font-medium text-brand-ink underline underline-offset-2">Add an example</Link></div>
        </div>
      )}
      {limitedEvidence && hiddenStrategies.length === 0 && (
        <p className="mb-3 rounded-xl border border-dashed px-4 py-3 text-[13px] leading-5 text-muted-foreground">
          These versions may look similar because your profile has only a couple of confirmed examples. Add another real example on your profile to give each version more to work with.
        </p>
      )}
      <div className={cn("grid gap-3", resumes.length === 1 ? "max-w-2xl" : resumes.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
        {resumes.map((r) => {
          const best = r.id === bestId;
          return (
            <article key={r.id} className={cn("flex flex-col rounded-2xl border bg-background p-5", best ? "border-brand/50 shadow-lift ring-1 ring-brand/30 max-lg:order-first" : "max-lg:p-4")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  {best ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand-ink">
                      <Check className="size-3" strokeWidth={3} />
                      Closest current version
                    </span>
                  ) : (
                    <span className="text-[11px] text-subtle-foreground">Another angle</span>
                  )}
                  <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight">{r.label}</h3>
                </div>
                <FileText className="size-5 shrink-0 text-subtle-foreground" />
              </div>
              <p className={cn("mt-1 text-[12.5px] leading-5 text-muted-foreground", !best && "max-lg:hidden")}>{r.blurb}</p>
              {r.total > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">Posting points shown on the page</span>
                    <span className="font-medium tabular-nums">
                      {r.covered}/{r.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full origin-left rounded-full bg-brand motion-safe:animate-bar-grow" style={{ width: `${(r.covered / r.total) * 100}%` }} />
                  </div>
                </div>
              )}
              <ul className={cn("mt-3 space-y-1.5", !best && "max-lg:hidden")}>
                {r.top.slice(0, 2).map((t) => (
                  <li key={t} className="flex gap-2 text-[12.5px] leading-5">
                    <Check className="mt-0.5 size-3 shrink-0 text-brand" />
                    <span className="line-clamp-2">{t}</span>
                  </li>
                ))}
              </ul>
              <div className={cn("mt-3 rounded-lg bg-muted/50 px-3 py-2 text-[12px] leading-5", !best && "max-lg:hidden")}>
                <p className={cn("font-medium", !r.checksOk ? "text-pending-ink" : r.passed === r.totalChecks ? "text-brand-ink" : "text-foreground")}>
                  {!r.checksOk ? "Needs a look before you send it" : r.passed === r.totalChecks ? `All ${r.totalChecks} resume checks passed` : `${r.passed} of ${r.totalChecks} resume checks passed`}
                </p>
                {r.fixFirst && <p className="text-muted-foreground">Next fix: {r.fixFirst}</p>}
              </div>
              <div className="mt-auto flex gap-2 pt-4">
                <Button size="sm" variant={best ? "default" : "outline"} asChild>
                  <Link href={`/app/resumes/${r.id}`}>Open</Link>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={`/api/resumes/${r.id}/pdf`}>
                    <Download data-icon="inline-start" />
                    PDF
                  </a>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-3 text-[13px] text-destructive">{error}</p>}
    </div>
  );
}
