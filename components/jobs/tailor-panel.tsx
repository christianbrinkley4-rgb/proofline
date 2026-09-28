"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Download, Info, LoaderCircle, Lock, Minus, RefreshCw, Scissors, SquareKanban } from "lucide-react";
import { toast } from "sonner";
import { rerunReviewAction, tailorJobAction } from "@/app/app/jobs/[id]/tailor-actions";
import { trackJobAction } from "@/app/app/tracker/actions";
import { PagePreview } from "@/components/resume/page-preview";
import { Button } from "@/components/ui/button";
import { downloadExport } from "@/lib/export-download";
import type { DrawOp } from "@/lib/resume/layout";
import type { CutItem, WhyItem } from "@/lib/resume/tailor";
import type { Template } from "@/lib/resume/templates";
import type { LintCheck } from "@/lib/review/linter";
import type { ModelReview } from "@/lib/review/model";
import { cn } from "@/lib/utils";

export type TailorResumeView = {
  resumeId: string;
  version: number;
  ops: DrawOp[];
  family: Template["family"];
  why: WhyItem[];
  cuts: CutItem[];
  adjustments: string[];
  linter: LintCheck[];
  model: ModelReview | null;
  reviewedAt: string | null;
  stale: boolean;
  canExport: boolean;
  reason: string | null;
  /** Resume lines with the bullet and facts behind each, to send a flagged quote back to its fact. */
  lines: Array<{ text: string; bulletId?: string; factIds?: string[] }>;
  /** Facts changed after this version was built. */
  outdated: boolean;
  aiConfigured: boolean;
};

type Panel = "review" | "why" | "cut";

/** The Tailor tab: build, review, fix, download. */
export function TailorPanel({ jobId, resume, blocked, autoBuild }: { jobId: string; resume: TailorResumeView | null; blocked: string | null; autoBuild: boolean }) {
  const router = useRouter();
  const [building, startBuild] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const build = () =>
    startBuild(async () => {
      setError(null);
      const result = await tailorJobAction(jobId).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
      if (!result.ok) setError(result.error);
      router.refresh();
    });

  useEffect(() => {
    if (autoBuild && !resume && !blocked && !started.current) {
      started.current = true;
      build();
    }
    // Build once on first open; later builds come from the buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (blocked) {
    return (
      <div className="rounded-2xl border bg-muted/40 p-5 text-[14px] leading-6">
        <p className="flex items-center gap-2 font-medium">
          <Lock className="size-4" />
          Tailoring is off for this job
        </p>
        <p className="mt-1 text-muted-foreground">{blocked}</p>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-background p-6 text-center">
        {building ? (
          <div role="status" className="flex flex-col items-center gap-2 text-[14px] text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" />
            Building the best one-page version from your confirmed facts, then reviewing every line.
          </div>
        ) : (
          <>
            <p className="text-[15px] font-medium">One resume for this job, built only from your confirmed facts.</p>
            <p className="mt-1 text-[13.5px] text-muted-foreground">Then every line is checked before you can download it.</p>
            <Button size="lg" className="mt-4" onClick={build}>
              Build my resume
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-pending-ink">
            {error}
          </p>
        )}
      </div>
    );
  }

  return <Workspace jobId={jobId} resume={resume} rebuilding={building} onRebuild={build} buildError={error} />;
}

function Workspace({ jobId, resume, rebuilding, onRebuild, buildError }: { jobId: string; resume: TailorResumeView; rebuilding: boolean; onRebuild: () => void; buildError: string | null }) {
  const router = useRouter();
  const failing = resume.linter.filter((c) => !c.passed);
  const blockingFails = failing.filter((c) => c.severity === "BLOCKING");
  const [panel, setPanel] = useState<Panel>(failing.length || resume.model?.status === "fail" ? "review" : "why");
  const [hovered, setHovered] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [reviewing, startReview] = useTransition();
  const [tracking, startTrack] = useTransition();
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const preview = useRef<HTMLDivElement>(null);

  /** The line (and its facts) a quote came from. */
  const lineFor = useMemo(() => (quote: string) => resume.lines.find((l) => l.text.includes(quote)), [resume.lines]);
  const flagged = useMemo(() => {
    const quotes = [...failing.flatMap((c) => c.failures), ...(resume.model?.issues.map((i) => i.quote) ?? [])];
    return new Set(quotes.map((q) => lineFor(q)?.bulletId).filter((id): id is string => Boolean(id)));
  }, [failing, resume.model, lineFor]);

  const showOnPage = (quote: string) => {
    const bulletId = lineFor(quote)?.bulletId ?? null;
    setFocus(bulletId);
    setHovered(bulletId);
    preview.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const fixHref = (quote: string) => {
    const factId = lineFor(quote)?.factIds?.[0];
    return `/app/facts?back=${encodeURIComponent(`/app/jobs/${jobId}?tab=tailor`)}${factId ? `#fact-${factId}` : ""}`;
  };

  const rerun = () =>
    startReview(async () => {
      const result = await rerunReviewAction(resume.resumeId).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
      if (!result.ok) toast.error(result.error);
      else toast(result.passed ? "Review passed. Downloads are on." : "Review finished. See what to fix.");
      setPanel("review");
      router.refresh();
    });

  const download = async (format: "pdf" | "docx") => {
    setDownloading(format);
    try {
      const result = await downloadExport(`/api/resumes/${resume.resumeId}/${format}`, `Resume.${format}`);
      if (!result.ok) {
        toast.error(result.message);
        setPanel("review");
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      {resume.outdated && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pending/40 bg-pending-soft px-4 py-3 text-[13.5px] text-pending-ink">
          <span>Your facts changed since this version was built.</span>
          <Button size="sm" variant="outline" className="bg-background" disabled={rebuilding} onClick={onRebuild}>
            {rebuilding ? <LoaderCircle className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
            Rebuild with my current facts
          </Button>
        </div>
      )}
      {buildError && (
        <p role="alert" className="mb-3 text-[13px] text-pending-ink">
          {buildError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["pdf", "docx"] as const).map((format) => (
          <Button
            key={format}
            size="sm"
            variant={format === "pdf" && resume.canExport ? "default" : "outline"}
            disabled={!resume.canExport || downloading !== null}
            onClick={() => download(format)}
            aria-describedby={resume.canExport ? undefined : "export-lock"}
          >
            {downloading === format ? <LoaderCircle className="animate-spin" /> : resume.canExport ? <Download data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
            {format.toUpperCase()}
          </Button>
        ))}
        <Button size="sm" variant="ghost" disabled={reviewing || rebuilding} onClick={rerun}>
          {reviewing ? <LoaderCircle className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
          Re-run review
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={tracking}
          onClick={() =>
            startTrack(async () => {
              try {
                await trackJobAction(jobId, resume.resumeId);
                toast("On your tracker with this resume.");
              } catch {
                toast.error("Couldn't add it to your tracker. Try again.");
              }
            })
          }
        >
          <SquareKanban data-icon="inline-start" />
          Track with this resume
        </Button>
      </div>
      {!resume.canExport && resume.reason && (
        <p id="export-lock" className="mt-2 flex items-start gap-1.5 text-[13px] text-pending-ink">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Downloads unlock when the review passes. {resume.reason}
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div ref={preview} className="scroll-mt-24 rounded-xl border bg-muted/60 p-3 sm:p-6" onMouseLeave={() => setHovered(focus)}>
          <div
            className="mx-auto max-w-[680px] shadow-[0_1px_3px_rgb(0_0_0/0.08),0_12px_32px_-16px_rgb(0_0_0/0.18)]"
            onMouseOver={(e) => {
              const ref = (e.target as Element).getAttribute?.("data-ref");
              if (ref) setHovered(ref);
            }}
          >
            <PagePreview ops={resume.ops} family={resume.family} hovered={hovered} flagged={flagged} />
          </div>
          <p className="mt-3 text-center text-[12px] text-subtle-foreground">
            The exact page, same line breaks as the PDF. Version {resume.version}.{flagged.size > 0 && " Highlighted lines need a fix."}
            <span className="sm:hidden"> To read it full size on a phone, download it once the review passes.</span>
          </p>
        </div>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background lg:sticky lg:top-6 lg:max-h-[calc(100dvh-8rem)]">
          <div role="tablist" aria-label="Resume reasoning" className="flex gap-1 overflow-x-auto border-b p-2">
            {(
              [
                ["review", `Review${blockingFails.length ? ` (${blockingFails.length} blocking)` : ""}`],
                ["why", "Why this works"],
                ["cut", `What I cut (${resume.cuts.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={panel === id}
                aria-controls="tailor-panel"
                onClick={() => setPanel(id)}
                className={cn("rounded-md px-2.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors pointer-coarse:py-2.5", panel === id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
          <div id="tailor-panel" role="tabpanel" className="scroll-thin space-y-2.5 overflow-y-auto p-3">
            {panel === "review" && <ReviewList resume={resume} showOnPage={showOnPage} fixHref={fixHref} reviewing={reviewing} />}
            {panel === "why" &&
              resume.why.map((w) => (
                <div
                  key={w.bulletId}
                  onMouseEnter={() => setHovered(w.bulletId)}
                  onMouseLeave={() => setHovered(focus)}
                  className={cn("rounded-lg border p-3 transition-colors", hovered === w.bulletId && "border-border-strong bg-muted/50")}
                >
                  <p className="text-[13px] leading-5 font-medium">{w.text}</p>
                  {w.addresses.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {w.addresses.slice(0, 4).map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] text-muted-foreground">
                          <Check className="size-3 text-brand" strokeWidth={2.5} />
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">{w.reason}</p>
                </div>
              ))}
            {panel === "cut" && (
              <>
                <p className="px-1 text-[12.5px] leading-5 text-muted-foreground">What stayed off this page, and why. Everything here is still on My facts.</p>
                {resume.adjustments.map((a) => (
                  <div key={a} className="rounded-lg border border-dashed p-3 text-[12.5px] text-muted-foreground">
                    {a}
                  </div>
                ))}
                {resume.cuts.length === 0 && <p className="px-1 text-[13px]">Nothing was cut. Everything fit.</p>}
                {resume.cuts.map((c, i) => (
                  <div key={`${c.bulletId}-${i}`} className="rounded-lg border p-3">
                    <div className="flex gap-2 text-[12.5px] leading-5 text-muted-foreground">
                      <Scissors className="mt-0.5 size-3.5 shrink-0" />
                      <span>{c.text}</span>
                    </div>
                    <p className="mt-1.5 pl-5.5 text-[12.5px] leading-5">{c.reason}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

const SEVERITY_ORDER = { BLOCKING: 0, WARN: 1, INFO: 2 } as const;

function ReviewList({ resume, showOnPage, fixHref, reviewing }: { resume: TailorResumeView; showOnPage: (q: string) => void; fixHref: (q: string) => string; reviewing: boolean }) {
  const checks = [...resume.linter].sort((a, b) => Number(a.passed) - Number(b.passed) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const model = resume.model;
  return (
    <>
      <div className={cn("rounded-lg border p-3", resume.canExport ? "border-brand/40 bg-brand-soft/50" : "border-pending/40 bg-pending-soft/50")}>
        <p className="text-[13px] font-semibold">{resume.canExport ? "Review passed. Downloads are on." : "Downloads are locked until the review passes."}</p>
        {resume.reviewedAt && <p className="mt-0.5 text-[12px] text-muted-foreground">Last review {new Date(resume.reviewedAt).toLocaleString()}.{resume.stale ? " Things changed since then." : ""}</p>}
      </div>

      <section aria-label="AI review" className="rounded-lg border p-3">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          {reviewing ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : model?.status === "pass" ? (
            <Dot tone="pass" />
          ) : model?.status === "fail" ? (
            <Dot tone="fail" />
          ) : (
            <Info className="size-4 text-muted-foreground" />
          )}
          AI review:{" "}
          {!resume.aiConfigured
            ? "temporarily unavailable"
            : !model
              ? "not run yet"
              : { pass: "PASS", fail: "FAIL", unavailable: "temporarily unavailable", limit: "daily limit reached", error: "didn't finish", skipped: "waiting on the checks below" }[model.status]}
        </p>
        <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
          {!resume.aiConfigured
            ? "AI review is temporarily unavailable. Scoring, these checks, and your tracker all still work. A resume that already passed can still be downloaded."
            : (model?.message ?? "Press Re-run review to check this version.")}
        </p>
        {model?.issues.map((issue) => (
          <div key={issue.quote} className="mt-2.5 rounded-md bg-muted/60 p-2.5 text-[12.5px] leading-5">
            <blockquote className="border-l-2 border-pending pl-2 font-medium">&ldquo;{issue.quote}&rdquo;</blockquote>
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium text-foreground">{issue.rule_broken}.</span> {issue.fix}
            </p>
            <div className="mt-1.5 flex gap-3">
              <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => showOnPage(issue.quote)}>
                Show on page
              </button>
              <Link href={fixHref(issue.quote)} className="font-medium underline-offset-2 hover:underline">
                Fix in My facts
              </Link>
            </div>
          </div>
        ))}
      </section>

      <ul className="divide-y rounded-lg border">
        {checks.map((c) => (
          <li key={c.id} className="p-3">
            <div className="flex gap-2.5">
              {c.passed ? (
                c.severity === "INFO" ? <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <Dot tone="pass" />
              ) : c.severity === "BLOCKING" ? (
                <Minus className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-pending" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
                  {c.label}
                  <span className={cn("rounded px-1 py-px text-[10.5px] font-semibold tracking-wide", c.severity === "BLOCKING" ? "bg-destructive/10 text-destructive" : c.severity === "WARN" ? "bg-pending-soft text-pending-ink" : "bg-muted text-muted-foreground")}>
                    {c.severity}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">{c.detail}</p>
                {!c.passed &&
                  c.failures.slice(0, 5).map((quote) => (
                    <div key={quote} className="mt-1.5 rounded-md bg-muted/60 p-2 text-[12.5px] leading-5">
                      <blockquote className="border-l-2 border-pending pl-2 break-words">&ldquo;{quote}&rdquo;</blockquote>
                      <div className="mt-1 flex gap-3">
                        <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => showOnPage(quote)}>
                          Show on page
                        </button>
                        <Link href={fixHref(quote)} className="font-medium underline-offset-2 hover:underline">
                          Fix in My facts
                        </Link>
                      </div>
                    </div>
                  ))}
                {!c.passed && c.failures.length > 5 && <p className="mt-1 text-[12px] text-muted-foreground">And {c.failures.length - 5} more.</p>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Dot({ tone }: { tone: "pass" | "fail" }) {
  return tone === "pass" ? (
    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand text-white">
      <Check className="size-2.5" strokeWidth={3.5} />
    </span>
  ) : (
    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-destructive text-white">
      <Minus className="size-2.5" strokeWidth={3.5} />
    </span>
  );
}
