"use client";

import { useState } from "react";
import { Check, Clock, Copy, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOLLOW_UP_DRAFT, TRACKER_CARDS, TRACKER_STAGES, TRACKER_STATS, type TrackerCard } from "@/lib/demo/sample-data";
import { cn } from "@/lib/utils";

export function TrackView({ followUpSent, onMarkSent, onUndo }: { followUpSent: boolean; onMarkSent: () => void; onUndo: () => void }) {
  const [draftOpen, setDraftOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Marking the follow-up sent moves its card out of the "due" state and updates the count.
  const cards = followUpSent
    ? TRACKER_CARDS.map((c) => (c.flag === "follow-up" ? { ...c, flag: "sent" as const, sentLabel: "Follow-up sent today" } : c))
    : TRACKER_CARDS;
  const stats = TRACKER_STATS.map((s) => (s.label === "Follow-ups due" ? { ...s, value: String(cards.filter((c) => c.flag === "follow-up").length) } : s));

  const copyDraft = async () => {
    try {
      const text = [`Subject: ${FOLLOW_UP_DRAFT.subject}`, ...FOLLOW_UP_DRAFT.body].join("\n\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (permissions, insecure context). The draft is still on screen to select by hand.
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <dl className="grid grid-cols-2 border-b sm:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn("px-4 py-3 sm:px-5", i % 2 === 1 && "border-l", i >= 2 && "border-t sm:border-t-0", i === 2 && "sm:border-l")}
          >
            <dt className="text-[12px] text-subtle-foreground">{s.label}</dt>
            <dd className="mt-0.5 text-[20px] font-semibold tracking-tight tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto bg-muted/40 p-3 sm:p-4">
        {TRACKER_STAGES.map((stage) => {
          const inStage = cards.filter((c) => c.stage === stage);
          return (
            <section key={stage} className="flex w-[11.5rem] shrink-0 flex-col md:w-auto md:min-w-0 md:flex-1">
              <h4 className="flex items-center justify-between px-1 pb-2 text-[12.5px] font-medium">
                {stage}
                <span className="text-[12px] font-normal text-subtle-foreground tabular-nums">{inStage.length}</span>
              </h4>
              <div className="space-y-2">
                {inStage.map((card) => (
                  <Card key={card.id} card={card} onOpenDraft={() => setDraftOpen(true)} />
                ))}
                {inStage.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border-strong p-3 text-[12px] leading-5 text-subtle-foreground">
                    Nothing yet. Two interviews in progress.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div role="status" className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-[12.5px] sm:px-5">
        {followUpSent ? (
          <>
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <Check className="size-3.5 shrink-0 text-brand" strokeWidth={3} />
              <span className="truncate">
                Follow-up to <span className="font-medium text-foreground">{FOLLOW_UP_DRAFT.company}</span> marked sent. Nothing else is due.
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={onUndo}>
              Undo
            </Button>
          </>
        ) : (
          <>
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-pending" />
              <span className="truncate">
                Follow up with <span className="font-medium text-foreground">{FOLLOW_UP_DRAFT.company}</span>. It&apos;s been 14
                days.
              </span>
            </span>
            <Button size="sm" variant="outline" onClick={() => setDraftOpen(true)}>
              <Mail data-icon="inline-start" />
              View draft
            </Button>
          </>
        )}
      </div>

      {draftOpen && (
        <div className="absolute inset-0 z-10 flex flex-col border-l bg-background shadow-[-12px_0_32px_-16px_rgb(0_0_0/0.18)] motion-safe:animate-view-in sm:left-auto sm:w-[23rem]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="text-[12px] text-subtle-foreground">Follow-up draft</div>
              <div className="text-[14px] font-semibold tracking-tight">{FOLLOW_UP_DRAFT.company}</div>
            </div>
            <Button size="icon-sm" variant="ghost" aria-label="Close draft" onClick={() => setDraftOpen(false)}>
              <X />
            </Button>
          </div>
          <div className="space-y-1 border-b px-4 py-2.5 text-[12.5px]">
            <div>
              <span className="text-subtle-foreground">To </span>
              {FOLLOW_UP_DRAFT.to}
            </div>
            <div>
              <span className="text-subtle-foreground">Subject </span>
              {FOLLOW_UP_DRAFT.subject}
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto scroll-thin px-4 py-3 text-[13px] leading-[1.6] whitespace-pre-line">
            {FOLLOW_UP_DRAFT.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="border-t px-4 py-3">
            <p className="mb-2.5 text-[12px] text-muted-foreground">
              Written from what you confirmed. Nothing sends until you send it.
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={copyDraft}>
                {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                {copied ? "Copied" : "Copy draft"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={followUpSent}
                onClick={() => {
                  onMarkSent();
                  setDraftOpen(false);
                }}
              >
                {followUpSent ? "Marked as sent" : "Mark as sent"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ card, onOpenDraft }: { card: TrackerCard & { sentLabel?: string }; onOpenDraft: () => void }) {
  const body = (
    <>
      <div className="truncate text-[12.5px] font-medium">{card.company}</div>
      <div className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-muted-foreground">{card.role}</div>
      <div className="mt-2 text-[11.5px] text-subtle-foreground">{card.meta}</div>
      {card.flag === "follow-up" && (
        <div className="mt-2 inline-flex items-center gap-1 rounded bg-pending-soft px-1.5 py-0.5 text-[11px] font-medium text-pending-ink">
          <Mail className="size-3" />
          Follow up today
        </div>
      )}
      {card.flag === "due-soon" && (
        <div className="mt-2 inline-flex items-center gap-1 rounded bg-pending-soft px-1.5 py-0.5 text-[11px] font-medium text-pending-ink">
          <Clock className="size-3" />
          Due in 3 days
        </div>
      )}
      {card.flag === "sent" && (
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-subtle-foreground">
          <Check className="size-3" />
          {card.sentLabel ?? "Follow-up sent Sep 17"}
        </div>
      )}
    </>
  );

  const className = "block w-full rounded-lg border bg-background p-2.5 text-left shadow-xs";
  return card.flag === "follow-up" ? (
    <button type="button" onClick={onOpenDraft} className={cn(className, "transition-colors hover:border-border-strong")}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
