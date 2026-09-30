import { ChevronRight, ClipboardPaste, CornerDownLeft, TriangleAlert } from "lucide-react";
import { DEMO_JOBS, jobFit, jobKnockouts } from "@/lib/demo/sample-data";
import { CompanyAvatar, ScoreMeter } from "./parts";

export function FindView({ onOpenJob }: { onOpenJob: (id: string) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4 sm:p-5">
        <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 shadow-xs">
          <ClipboardPaste className="size-4 shrink-0 text-subtle-foreground" />
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-muted-foreground">Paste a job link or the full posting</span>
          <kbd className="hidden items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-subtle-foreground sm:inline-flex">
            <CornerDownLeft className="size-3" />
            Enter
          </kbd>
        </div>
        <p className="mt-3 text-[12px] leading-5 text-subtle-foreground">
          A link from LinkedIn, Indeed, Handshake, or a company site, or the posting text itself.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5 text-[12px] text-subtle-foreground sm:px-5">
        <span>
          <span className="font-medium text-foreground">{DEMO_JOBS.length} saved roles</span>, each checked for knockouts, then scored
        </span>
        <span className="hidden shrink-0 lg:inline">Sorted by best fit</span>
      </div>

      <ul className="divide-y md:overflow-y-auto scroll-thin">
        {DEMO_JOBS.map((job) => {
          const fit = jobFit(job);
          const knockout = jobKnockouts(job).find((k) => k.status === "knockout");
          return (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => onOpenJob(job.id)}
                className="group flex w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
              >
                <CompanyAvatar name={job.company} className="hidden sm:grid" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] leading-5 font-medium">{job.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] leading-5 text-muted-foreground">
                    {job.company} · {job.location} · {job.mode}
                  </span>
                  <span className="mt-1 block truncate text-[12px] leading-4 text-subtle-foreground">
                    {job.pay ?? "Pay not listed"} · Due {job.deadline} · pasted from {job.source}
                  </span>
                  {knockout && (
                    <span className="mt-1.5 flex items-start gap-1.5 text-[12px] text-pending-ink">
                      <TriangleAlert className="mt-px size-3.5 shrink-0" />
                      <span className="line-clamp-2 sm:truncate">Knockout: {knockout.reason}</span>
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

      <div className="mt-auto flex items-center gap-2 border-t bg-muted/40 px-4 py-2.5 text-[12px] text-muted-foreground sm:px-5">
        <span className="size-1.5 shrink-0 rounded-full bg-brand" />
        Knockouts show first. A role you can&apos;t take never gets a tailored resume.
      </div>
    </div>
  );
}
