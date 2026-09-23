import { Bell, ChevronRight, CornerDownLeft, Search, TriangleAlert } from "lucide-react";
import { DEMO_INTENT, DEMO_JOBS, DEMO_QUERY, DEMO_SEARCH_META, jobFit } from "@/lib/demo/sample-data";
import { CompanyAvatar, ScoreMeter } from "./parts";

export function FindView({ onOpenJob }: { onOpenJob: (id: string) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4 sm:p-5">
        <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 shadow-xs">
          <Search className="size-4 shrink-0 text-subtle-foreground" />
          <span className="min-w-0 flex-1 text-[13.5px] sm:truncate">{DEMO_QUERY}</span>
          <kbd className="hidden items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-subtle-foreground sm:inline-flex">
            <CornerDownLeft className="size-3" />
            Enter
          </kbd>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12px] text-subtle-foreground">Understood as</span>
          {DEMO_INTENT.map((chip) => (
            <span key={chip.label} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[12px] leading-4">
              <span className="text-subtle-foreground">{chip.label}</span>
              <span className="font-medium">{chip.value}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5 text-[12px] text-subtle-foreground sm:px-5">
        <span>
          <span className="font-medium text-foreground">{DEMO_SEARCH_META.matches} matches</span> from{" "}
          {DEMO_SEARCH_META.boards} company job boards · {DEMO_SEARCH_META.duplicatesMerged} duplicates merged
        </span>
        <span className="hidden shrink-0 lg:inline">Sorted by best fit</span>
      </div>

      <ul className="divide-y md:overflow-y-auto scroll-thin">
        {DEMO_JOBS.map((job) => {
          const fit = jobFit(job);
          return (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => onOpenJob(job.id)}
                className="group flex w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-5"
              >
                <CompanyAvatar name={job.company} className="hidden sm:grid" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] leading-5 font-medium">{job.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] leading-5 text-muted-foreground">
                    {job.company} · {job.location} · {job.mode}
                  </span>
                  <span className="mt-1 block truncate text-[12px] leading-4 text-subtle-foreground">
                    {job.pay ?? "Pay not listed"} · Due {job.deadline} · via {job.source} · {job.posted}
                  </span>
                  {fit.cappedBy && (
                    <span className="mt-1.5 flex items-start gap-1.5 text-[12px] text-pending-ink">
                      <TriangleAlert className="mt-px size-3.5 shrink-0" />
                      <span className="line-clamp-2 sm:truncate">Capped at {fit.score}: {fit.cappedBy.reason}</span>
                    </span>
                  )}
                </span>
                <ScoreMeter score={fit.score} />
                <ChevronRight className="hidden size-4 shrink-0 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 border-t bg-muted/40 px-4 py-2.5 text-[12px] text-muted-foreground sm:px-5">
        <span className="flex items-center gap-2">
          <Bell className="size-3.5 shrink-0" />
          Saved. You&apos;ll get an alert when new matches post.
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-foreground">
          <span className="size-1.5 rounded-full bg-brand" />
          Alerts on
        </span>
      </div>
    </div>
  );
}
