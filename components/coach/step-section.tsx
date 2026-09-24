"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One step of a guided sequence. The current step is open; done and upcoming
 * steps collapse to a single line. Opening the page at #id (from the coach or a
 * chat link) opens that step.
 */
export function StepSection({
  id,
  index,
  title,
  summary,
  state,
  children,
}: {
  id: string;
  /** Step number, or null for an unnumbered extra. */
  index: number | null;
  title: string;
  /** One line shown when collapsed. */
  summary?: React.ReactNode;
  state: "done" | "current" | "upcoming" | "extra";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(state === "current");

  useEffect(() => {
    const sync = () => {
      if (window.location.hash === `#${id}`) setOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [id]);

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 rounded-2xl border bg-background transition-colors",
        state === "current" && "border-border-strong shadow-lift",
        state === "upcoming" && "bg-muted/30",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left sm:px-6"
      >
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full font-mono text-[12px] tabular-nums",
            state === "done" ? "bg-brand text-background" : state === "current" ? "bg-ink text-ink-foreground" : "bg-muted text-subtle-foreground ring-1 ring-border",
          )}
        >
          {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : index ?? "+"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn("text-[16px] font-semibold tracking-tight", state === "upcoming" && "text-muted-foreground")}>{title}</span>
            {state === "current" && <span className="text-[12px] font-medium text-brand-ink">Do this now</span>}
          </span>
          {summary && !open && <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-subtle-foreground transition-transform", open && "rotate-180")} />
      </button>
      {/* Kept mounted while closed so drafts in progress are never lost. */}
      <div id={`${id}-body`} hidden={!open} className="border-t px-5 pt-4 pb-5 motion-safe:animate-view-in sm:px-6 sm:pb-6">
        {children}
      </div>
    </section>
  );
}
