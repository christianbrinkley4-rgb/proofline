"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Bookmark, BookmarkCheck, OctagonX, X } from "lucide-react";
import { toast } from "sonner";
import { dismissFeedJobAction, saveFeedJobAction, undoDismissFeedJobAction, unsaveFeedJobAction } from "@/app/app/find/actions";
import { CompanyAvatar, MatchChip } from "@/components/shared/fit";
import { Button } from "@/components/ui/button";
import type { FeedItem } from "@/lib/jobs/feed/load";
import { cn } from "@/lib/utils";
import { tidyLocation } from "@/lib/jobs/locations";

function postedAgo(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const days = Math.floor((now - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 7) return `Posted ${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `Posted ${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

type Change = { jobId: string; saved?: boolean; dismissed?: boolean };

export function FeedList({ items, now }: { items: FeedItem[]; now: string }) {
  const [, startTransition] = useTransition();
  const [shown, change] = useOptimistic(
    items.map((item) => ({ ...item, dismissed: false })),
    (state, next: Change) => state.map((item) => (item.jobId === next.jobId ? { ...item, ...next } : item)),
  );
  const nowMs = new Date(now).getTime();

  const toggleSave = (item: FeedItem & { saved: boolean }) =>
    startTransition(async () => {
      change({ jobId: item.jobId, saved: !item.saved });
      try {
        await (item.saved ? unsaveFeedJobAction(item.jobId) : saveFeedJobAction(item.jobId));
        if (!item.saved) toast.success("Saved. It's under Your jobs too.");
      } catch {
        toast.error("Couldn't save that job. Try again.");
      }
    });

  const dismiss = (item: FeedItem) =>
    startTransition(async () => {
      change({ jobId: item.jobId, dismissed: true });
      try {
        await dismissFeedJobAction(item.jobId);
        toast("Dismissed. Similar jobs will rank lower.", {
          duration: 8000,
          action: { label: "Undo", onClick: () => startTransition(() => undoDismissFeedJobAction(item.jobId, item.saved)) },
        });
      } catch {
        toast.error("Couldn't dismiss that job. Try again.");
      }
    });

  const visible = shown.filter((item) => !item.dismissed);

  return (
    <ul className="divide-y rounded-2xl border bg-background">
      {visible.map((item) => {
        const posted = postedAgo(item.postedAt, nowMs);
        const meta = [item.company, tidyLocation(item.location), item.pay].filter(Boolean).join(" · ");
        return (
          <li key={item.jobId} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:gap-3">
            <Link href={`/app/jobs/${item.jobId}`} className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg">
              <CompanyAvatar name={item.company} className="mt-0.5 hidden sm:grid" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-5 font-medium group-hover:underline group-hover:underline-offset-2">{item.title}</span>
                <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{meta}</span>
                {(posted || item.alsoIn.length > 0) && (
                  <span className="block text-[12px] text-subtle-foreground">
                    {[posted, item.alsoIn.length ? `Also in ${item.alsoIn.length} other place${item.alsoIn.length === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
                  </span>
                )}
                {item.chips.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {item.chips.map((chip) =>
                      chip.kind === "knockout" ? (
                        <span key={chip.text} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 text-[12px] leading-5 text-destructive">
                          <OctagonX className="size-3" aria-hidden="true" />
                          Knockout: {chip.text}
                        </span>
                      ) : (
                        <MatchChip key={chip.text} matched={chip.kind === "match"}>
                          {chip.text}
                        </MatchChip>
                      ),
                    )}
                  </span>
                )}
                <span className={cn("mt-2 block text-[13px] leading-5 text-pretty", item.knockout ? "text-destructive" : "text-muted-foreground")}>
                  {item.knockout ? item.knockout.reason : item.reason}
                </span>
                {item.preferenceNote && (
                  <span className="mt-1 flex items-center gap-1 text-[12px] text-subtle-foreground">
                    {item.preferenceNote.startsWith("Moved up") ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />}
                    {item.preferenceNote}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className={cn("block font-display text-[24px] leading-none font-semibold tabular-nums", item.knockout && "text-muted-foreground")}>{item.score}{" "}</span>
                <span className="text-[11px] text-subtle-foreground">fit</span>
              </span>
            </Link>
            <span className="flex gap-1 sm:flex-col">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSave(item)}
                aria-pressed={item.saved}
                className={cn("justify-start", item.saved && "text-brand-ink")}
              >
                {item.saved ? <BookmarkCheck /> : <Bookmark />}
                {item.saved ? "Saved" : "Save"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => dismiss(item)} className="justify-start text-muted-foreground">
                <X />
                Dismiss
              </Button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
