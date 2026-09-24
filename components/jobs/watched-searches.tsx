"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, LoaderCircle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { markSearchViewedAction, refreshSearchAction, unwatchSearchAction } from "@/app/app/jobs/actions";
import { cn } from "@/lib/utils";

export type WatchedChip = { id: string; query: string; fresh: number; lastRunAt: string | null };

function ago(iso: string | null): string {
  if (!iso) return "not run yet";
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  if (hours < 1) return "checked just now";
  if (hours < 24) return `checked ${hours}h ago`;
  return `checked ${Math.floor(hours / 24)}d ago`;
}

/** Watched searches above the search box: open one, check it now, or stop watching. */
export function WatchedSearches({ searches }: { searches: WatchedChip[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  if (!searches.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-[12px] text-subtle-foreground">
        <BellRing className="size-3.5" />
        Watching
      </span>
      {searches.map((s) => (
        <span key={s.id} className={cn("group inline-flex items-center rounded-full border bg-background text-[12.5px]", s.fresh > 0 && "border-brand/40")}>
          <button
            type="button"
            title={ago(s.lastRunAt)}
            className="max-w-[18rem] truncate py-1 pr-1.5 pl-3 hover:text-foreground"
            onClick={() =>
              startTransition(async () => {
                if (s.fresh) await markSearchViewedAction(s.id);
                router.push(`/app/jobs?q=${encodeURIComponent(s.query)}`);
              })
            }
          >
            {s.query}
          </button>
          {s.fresh > 0 && <span className="mr-1 rounded-full bg-brand-soft px-1.5 text-[11px] font-medium text-brand-ink tabular-nums">{s.fresh} new</span>}
          <button
            type="button"
            aria-label={`Check "${s.query}" now`}
            disabled={busy !== null}
            className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => {
              setBusy(s.id);
              startTransition(async () => {
                try {
                  const result = await refreshSearchAction(s.id);
                  toast(result.fresh ? `${result.fresh} new ${result.fresh === 1 ? "match" : "matches"} for "${s.query}".` : `Nothing new for "${s.query}" yet.`);
                  router.refresh();
                } catch {
                  toast.error("Couldn't check that search. Try again in a moment.");
                } finally {
                  setBusy(null);
                }
              });
            }}
          >
            {busy === s.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label={`Stop watching "${s.query}"`}
            className="mr-1 grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            onClick={() =>
              startTransition(async () => {
                await unwatchSearchAction(s.id);
                router.refresh();
              })
            }
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
}
