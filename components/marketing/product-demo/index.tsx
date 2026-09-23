"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { DEMO_CANDIDATE, DEMO_JOBS, jobFit } from "@/lib/demo/sample-data";
import { cn } from "@/lib/utils";
import { DemoSidebar } from "./demo-sidebar";
import { FindView } from "./find-view";
import { ScoreView } from "./score-view";
import { TailorView, type PendingState } from "./tailor-view";
import { TrackView } from "./track-view";

export type DemoTab = "find" | "score" | "tailor" | "track";

const STEPS: { id: DemoTab; label: string; blurb: string }[] = [
  { id: "find", label: "Find", blurb: "Say what you want. It searches live job boards." },
  { id: "score", label: "Score", blurb: "A fit score out of 100, with the math shown." },
  { id: "tailor", label: "Tailor", blurb: "A one-page resume from facts you confirmed." },
  { id: "track", label: "Track", blurb: "Every application and follow-up in one place." },
];

export function ProductDemo() {
  const [tab, setTab] = useState<DemoTab>("find");
  const [jobId, setJobId] = useState(DEMO_JOBS[0].id);
  const [pending, setPending] = useState<PendingState>("pending");
  const [hours, setHours] = useState(3);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tablistRef = useRef<HTMLDivElement>(null);

  const job = DEMO_JOBS.find((j) => j.id === jobId) ?? DEMO_JOBS[0];
  // A capped job isn't worth tailoring, so the Tailor step falls back to the best match.
  const tailorJob = jobFit(job).cappedBy ? DEMO_JOBS[0] : job;

  const facts = {
    confirmed: DEMO_CANDIDATE.profileFacts.confirmed + (pending === "confirmed" ? 1 : 0),
    toReview: pending === "pending" ? DEMO_CANDIDATE.profileFacts.toReview : 0,
  };

  // Moves between views from inside the panel. On phones the panel is tall, so bring its top back into view.
  const goTo = (next: DemoTab) => {
    setTab(next);
    requestAnimationFrame(() => {
      const el = tablistRef.current;
      if (el && el.getBoundingClientRect().top < 0) {
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
      }
    });
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + STEPS.length) % STEPS.length;
    setTab(STEPS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div>
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Product tour"
        className="grid scroll-mt-20 grid-cols-4 gap-1 rounded-xl border bg-background p-1 shadow-xs"
      >
        {STEPS.map((step, i) => {
          const active = tab === step.id;
          return (
            <button
              key={step.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`demo-tab-${step.id}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls="demo-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(step.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={cn(
                "rounded-lg px-2.5 py-2 text-left transition-colors sm:px-3.5 sm:py-3",
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("font-mono text-[11px] tabular-nums", active ? "text-brand-ink" : "text-subtle-foreground")}>
                  0{i + 1}
                </span>
                <span className="text-[13.5px] font-medium">{step.label}</span>
              </span>
              <span className="mt-1 hidden text-[12.5px] leading-5 text-muted-foreground md:block">{step.blurb}</span>
            </button>
          );
        })}
      </div>

      <div
        id="demo-panel"
        role="tabpanel"
        aria-labelledby={`demo-tab-${tab}`}
        className="mt-3 overflow-hidden rounded-xl border border-border-strong/60 bg-background shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_56px_-24px_rgb(0_0_0/0.22)]"
      >
        <div className="flex md:h-[40rem]">
          <DemoSidebar tab={tab} facts={facts} />
          <div className="min-w-0 flex-1">
            <div key={tab === "score" ? `score-${job.id}` : tab} className="h-full motion-safe:animate-view-in">
              {tab === "find" && (
                <FindView
                  onOpenJob={(id) => {
                    setJobId(id);
                    goTo("score");
                  }}
                />
              )}
              {tab === "score" && <ScoreView job={job} onBack={() => goTo("find")} onTailor={() => goTo("tailor")} />}
              {tab === "tailor" && (
                <TailorView
                  job={tailorJob}
                  pending={pending}
                  hours={hours}
                  onConfirm={(h) => {
                    setHours(h);
                    setPending("confirmed");
                  }}
                  onRemove={() => setPending("removed")}
                  onUndo={() => setPending("pending")}
                />
              )}
              {tab === "track" && <TrackView />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
