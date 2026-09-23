"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Lightbulb, Minus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_TOP_GAP, jobFit, type DemoJob } from "@/lib/demo/sample-data";
import { FIT_BAND_LABEL, FIT_COMPONENTS, fitBand, type FitComponentKey } from "@/lib/fit/rubric";
import { cn } from "@/lib/utils";
import { MatchChip } from "./parts";

export function ScoreView({
  job,
  onBack,
  onTailor,
}: {
  job: DemoJob;
  onBack: () => void;
  onTailor: () => void;
}) {
  const [open, setOpen] = useState<FitComponentKey | null>("requiredSkills");
  const fit = jobFit(job);
  const band = fitBand(fit.score);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 inline-flex items-center gap-1 rounded px-1 text-[12px] text-subtle-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            All results
          </button>
          <h3 className="mt-1 text-[16px] font-semibold tracking-tight">{job.title}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {job.company} · {job.location} · {job.mode} · {job.pay ?? "Pay not listed"} · Due {job.deadline}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-baseline justify-end gap-0.5">
            <span className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{fit.score}</span>
            <span className="text-[13px] text-subtle-foreground">/100</span>
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[12px] font-medium">
            <span className={cn("size-1.5 rounded-full", band === "strong" || band === "good" ? "bg-brand" : "bg-border-strong")} />
            {FIT_BAND_LABEL[band]}
          </div>
        </div>
      </div>

      {fit.cappedBy && (
        <div className="flex items-start gap-2 border-b bg-pending-soft px-4 py-2.5 text-[12.5px] text-pending-ink sm:px-5">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-medium">Capped at {fit.score} from {fit.raw}.</span> {fit.cappedBy.reason}
          </span>
        </div>
      )}

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_17rem]">
        <ul className="divide-y md:overflow-y-auto scroll-thin">
          {FIT_COMPONENTS.map(({ key, label, max }) => {
            const points = job.points[key];
            const detail = job.details[key];
            const expanded = open === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : key)}
                  className="w-full px-4 py-2.5 text-left transition-colors hover:bg-muted/50 sm:px-5"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13.5px] font-medium">
                      <ChevronDown
                        className={cn("size-3.5 shrink-0 text-subtle-foreground transition-transform", !expanded && "-rotate-90")}
                      />
                      <span className="truncate">{label}</span>
                    </span>
                    <span className="hidden h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-muted sm:block lg:w-36">
                      <span
                        className="block h-full origin-left rounded-full bg-brand motion-safe:animate-bar-grow"
                        style={{ width: `${(points / max) * 100}%` }}
                      />
                    </span>
                    <span className="w-11 shrink-0 text-right text-[13px] tabular-nums">
                      <span className="font-semibold">{points}</span>
                      <span className="text-subtle-foreground">/{max}</span>
                    </span>
                  </span>
                  <span className="mt-1 block pl-5 text-[12.5px] leading-5 text-muted-foreground">{detail.note}</span>
                </button>
                {expanded && (
                  <div className="flex flex-wrap gap-1.5 px-4 pt-0.5 pb-3.5 pl-9 sm:px-5 sm:pl-10">
                    {detail.matched.map((m) => (
                      <MatchChip key={m} matched>
                        {m}
                      </MatchChip>
                    ))}
                    {detail.missing.map((m) => (
                      <MatchChip key={m} matched={false}>
                        {m}
                      </MatchChip>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <aside className="flex flex-col gap-5 border-t bg-muted/40 p-4 sm:p-5 md:overflow-y-auto scroll-thin md:border-t-0 md:border-l">
          <div>
            <h4 className="text-[12px] font-medium text-subtle-foreground">Your strengths for this role</h4>
            <ul className="mt-2 space-y-1.5">
              {job.strengths.map((s) => (
                <li key={s} className="flex gap-2 text-[13px]">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-brand" strokeWidth={2.5} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[12px] font-medium text-subtle-foreground">Gaps</h4>
            <ul className="mt-2 space-y-1.5">
              {job.gaps.map((g) => (
                <li key={g} className="flex gap-2 text-[13px] text-muted-foreground">
                  <Minus className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
                  {g}
                </li>
              ))}
            </ul>
          </div>

          {fit.cappedBy ? (
            <div className="rounded-lg border bg-background p-3 text-[12.5px] leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">Skip this one for now.</span> You match the work, but not the
              graduation window. If they open a 2028 cohort, your saved search will catch it.
            </div>
          ) : (
            <div className="rounded-lg border bg-background p-3 text-[12.5px] leading-5 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Lightbulb className="size-3.5" />
                Across your {DEMO_TOP_GAP.saved} saved roles
              </div>
              <p className="mt-1">
                {DEMO_TOP_GAP.skill} shows up in {DEMO_TOP_GAP.count} of them. Fastest fix: {DEMO_TOP_GAP.fix}
              </p>
            </div>
          )}

          <div className="mt-auto">
            {fit.cappedBy ? (
              <Button variant="outline" className="w-full" onClick={onBack}>
                Back to results
              </Button>
            ) : (
              <Button className="w-full" onClick={onTailor}>
                Tailor my resume for this job
                <ArrowRight data-icon="inline-end" />
              </Button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
