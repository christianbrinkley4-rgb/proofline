"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, CircleAlert, Download, Info, LoaderCircle, Lock, Minus, Pencil, RefreshCw, Scissors, SquareKanban } from "lucide-react";
import { toast } from "sonner";
import { editLineAction, rerunReviewAction, shareResumeAction, stopSharingAction, tailorJobAction } from "@/app/app/jobs/[id]/tailor-actions";
import { trackJobAction } from "@/app/app/tracker/actions";
import { ConfirmBox } from "@/components/facts/confirm-box";
import { PagePreview } from "@/components/resume/page-preview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { downloadExport } from "@/lib/export-download";
import type { DrawOp } from "@/lib/resume/layout";
import type { CutItem, WhyItem } from "@/lib/resume/tailor";
import type { Template } from "@/lib/resume/templates";
import type { LintCheck } from "@/lib/review/linter";
import type { ModelReview } from "@/lib/review/model";
import { cn } from "@/lib/utils";
import { onTabListKeyDown } from "@/components/shared/tab-keys";

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
  /**
   * Resume lines with the bullet and facts behind each, to send a flagged quote back to its fact.
   * factText is the person's own words when the line is exactly one of their bullet facts.
   */
  lines: Array<{ text: string; bulletId?: string; factIds?: string[]; factText?: string }>;
  /** Facts changed after this version was built. */
  outdated: boolean;
  aiConfigured: boolean;
  /** The active proof link for this resume, if the person shared one. */
  shareSlug: string | null;
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
          No resume for this one
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
            Making your one-page resume from what you confirmed, then checking every line. This takes a few seconds.
          </div>
        ) : (
          <>
            <p className="text-[15px] font-medium">One resume for this job, made only from what you confirmed.</p>
            <p className="mt-1 text-[13.5px] text-muted-foreground">Every line is checked before you can download it.</p>
            <Button size="xl" className="mt-4" onClick={build}>
              Make my resume
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
  const [editing, setEditing] = useState<string | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const editingLine = editing ? resume.lines.find((l) => l.bulletId === editing) : undefined;

  const startEdit = (bulletId: string | null | undefined) => {
    if (!bulletId) return;
    setEditing(bulletId);
    setFocus(bulletId);
    setHovered(bulletId);
    preview.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      else toast(result.passed ? "Every check passed. You can download it now." : "Checked. See what to fix.");
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
          <span>You&apos;ve changed your experience since this version was made.</span>
          <Button size="sm" variant="outline" className="bg-background" disabled={rebuilding} onClick={onRebuild}>
            {rebuilding ? <LoaderCircle className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
            Remake it with my changes
          </Button>
        </div>
      )}
      {buildError && (
        <p role="alert" className="mb-3 text-[13px] text-pending-ink">
          {buildError}
        </p>
      )}

      {resume.canExport ? (
        <div className="rounded-2xl border border-brand/30 bg-brand-soft/40 p-4 sm:p-5">
          <p className="flex items-center gap-2 font-display text-[19px] font-semibold">
            <Check className="size-5 text-brand" strokeWidth={3} aria-hidden="true" />
            Your resume is ready
          </p>
          <p className="mt-1 text-[13.5px] leading-5 text-muted-foreground">One page, every line checked against what you confirmed.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="xl" disabled={downloading !== null} onClick={() => download("pdf")}>
              {downloading === "pdf" ? <LoaderCircle className="animate-spin" /> : <Download data-icon="inline-start" />}
              Download PDF
            </Button>
            <Button size="lg" variant="ghost" disabled={downloading !== null} onClick={() => download("docx")}>
              {downloading === "docx" ? <LoaderCircle className="animate-spin" /> : null}
              Word file instead
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-pending/40 bg-pending-soft/40 p-4 sm:p-5">
          <p id="export-lock" className="flex items-start gap-2 text-[14px] leading-6">
            <Lock className="mt-1 size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium">Almost there.</span> {resume.reason ?? "A few lines need a fix before you can download."}
            </span>
          </p>
          <Button size="lg" className="mt-3" disabled={reviewing || rebuilding} onClick={rerun}>
            {reviewing ? <LoaderCircle className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
            Check it again
          </Button>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div ref={preview} className="scroll-mt-24 rounded-xl border bg-muted/60 p-3 sm:p-6" onMouseLeave={() => setHovered(focus)}>
          {editing && <EditLine key={editing} jobId={jobId} line={editingLine} onClose={() => setEditing(null)} />}
          <div
            className="mx-auto max-w-[680px] shadow-[0_1px_3px_rgb(0_0_0/0.08),0_12px_32px_-16px_rgb(0_0_0/0.18)] [&_text[data-ref]]:cursor-pointer"
            onMouseOver={(e) => {
              const ref = (e.target as Element).getAttribute?.("data-ref");
              if (ref) setHovered(ref);
            }}
            onClick={(e) => startEdit((e.target as Element).getAttribute?.("data-ref"))}
          >
            <PagePreview ops={resume.ops} family={resume.family} hovered={hovered} flagged={flagged} />
          </div>
          <p className="mt-3 text-center text-[12px] text-subtle-foreground">
            The exact page, same line breaks as the PDF.{flagged.size > 0 && " Highlighted lines need a fix."} Tap any line to edit it.
            <span className="sm:hidden"> To read it full size on a phone, download it.</span>
          </p>
        </div>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background lg:sticky lg:top-6 lg:max-h-[calc(100dvh-8rem)]">
          <div role="tablist" aria-label="About this resume" onKeyDown={onTabListKeyDown} className="flex gap-1 overflow-x-auto border-b p-2">
            {(
              [
                ["review", `Checks${blockingFails.length ? ` (${blockingFails.length} to fix)` : ""}`],
                ["why", "Why each line"],
                ["cut", `Left off (${resume.cuts.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                id={`tailor-tab-${id}`}
                aria-selected={panel === id}
                tabIndex={panel === id ? 0 : -1}
                aria-controls="tailor-panel"
                onClick={() => setPanel(id)}
                className={cn("rounded-md px-2.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors pointer-coarse:py-2.5", panel === id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
          <div id="tailor-panel" role="tabpanel" aria-labelledby={`tailor-tab-${panel}`} className="scroll-thin space-y-2.5 overflow-y-auto p-3">
            {panel === "review" && (
              <ReviewList resume={resume} showOnPage={showOnPage} fixHref={fixHref} editHere={(q) => startEdit(lineFor(q)?.bulletId)} canEditHere={(q) => Boolean(lineFor(q)?.bulletId)} reviewing={reviewing} />
            )}
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
                  <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium underline-offset-2 hover:underline" onClick={() => startEdit(w.bulletId)}>
                    <Pencil className="size-3" aria-hidden="true" />
                    Edit this line
                  </button>
                </div>
              ))}
            {panel === "cut" && (
              <>
                <p className="px-1 text-[12.5px] leading-5 text-muted-foreground">What didn&apos;t fit on one page, and why. All of it is still saved in My experience.</p>
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

      {resume.canExport && (
        <section aria-labelledby="next-heading" className="mt-8">
          <h2 id="next-heading" className="text-[15px] font-semibold">
            What&apos;s next (optional)
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-background p-4">
              <p className="text-[14px] font-medium">Keep track of it</p>
              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">Saves this exact resume with the job, and reminds you to follow up two weeks after you apply.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={tracking}
                onClick={() =>
                  startTrack(async () => {
                    try {
                      await trackJobAction(jobId, resume.resumeId);
                      toast("Added to your applications with this resume.");
                    } catch {
                      toast.error("Couldn't add it to your applications. Try again.");
                    }
                  })
                }
              >
                {tracking ? <LoaderCircle className="animate-spin" /> : <SquareKanban data-icon="inline-start" />}
                Add to my applications
              </Button>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-[14px] font-medium">Cover letter and interview prep</p>
              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">Written from the same things you confirmed, for this job.</p>
              <Button size="sm" variant="outline" className="mt-3" asChild>
                <Link href={`/app/jobs/${jobId}/packet`}>
                  Open
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </div>
          <ProofLink resumeId={resume.resumeId} slug={resume.shareSlug} />
        </section>
      )}
    </div>
  );
}

const SEVERITY_ORDER = { BLOCKING: 0, WARN: 1, INFO: 2 } as const;
const SEVERITY_LABEL = { BLOCKING: "Must fix", WARN: "Worth a look", INFO: "Note" } as const;

function ReviewList({
  resume,
  showOnPage,
  fixHref,
  editHere,
  canEditHere,
  reviewing,
}: {
  resume: TailorResumeView;
  showOnPage: (q: string) => void;
  fixHref: (q: string) => string;
  editHere: (q: string) => void;
  canEditHere: (q: string) => boolean;
  reviewing: boolean;
}) {
  const checks = [...resume.linter].sort((a, b) => Number(a.passed) - Number(b.passed) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  // What needs attention (and notes worth reading) stays open; checks that passed fold into one line.
  const open = checks.filter((c) => !c.passed || c.severity === "INFO");
  const passed = checks.filter((c) => c.passed && c.severity !== "INFO");
  const model = resume.model;
  const row = (c: LintCheck) => (
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
            <span
              className={cn(
                "rounded px-1 py-px text-[10.5px] font-semibold tracking-wide",
                c.passed || c.severity === "INFO" ? "bg-muted text-muted-foreground" : c.severity === "BLOCKING" ? "bg-destructive/10 text-destructive" : "bg-pending-soft text-pending-ink",
              )}
            >
              {SEVERITY_LABEL[c.severity]}
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
                  <FixLink quote={quote} fixHref={fixHref} editHere={editHere} canEditHere={canEditHere} />
                </div>
              </div>
            ))}
          {!c.passed && c.failures.length > 5 && <p className="mt-1 text-[12px] text-muted-foreground">And {c.failures.length - 5} more.</p>}
        </div>
      </div>
    </li>
  );
  return (
    <>
      <div className={cn("rounded-lg border p-3", resume.canExport ? "border-brand/40 bg-brand-soft/50" : "border-pending/40 bg-pending-soft/50")}>
        <p className="text-[13px] font-semibold">{resume.canExport ? "Every check passed." : "Fix the lines below, then check again to download."}</p>
        {resume.reviewedAt && <p className="mt-0.5 text-[12px] text-muted-foreground">Last checked {new Date(resume.reviewedAt).toLocaleString()}.{resume.stale ? " Things changed since then." : ""}</p>}
      </div>

      <section aria-label="Final read-through" className="rounded-lg border p-3">
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
          Final read-through:{" "}
          {!resume.aiConfigured
            ? "not available right now"
            : !model
              ? "not run yet"
              : { pass: "passed", fail: "found lines to fix", unavailable: "not available right now", limit: "daily limit reached", error: "didn't finish", skipped: "runs once the checks below pass" }[model.status]}
        </p>
        <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
          {!resume.aiConfigured
            ? "An AI reads every line against what you confirmed before you download. It's not available right now. Everything else still works, and a resume that already passed can still be downloaded."
            : (model?.message ?? "Press Check it again to check this version.")}
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
              <FixLink quote={issue.quote} fixHref={fixHref} editHere={editHere} canEditHere={canEditHere} />
            </div>
          </div>
        ))}
      </section>

      {open.length > 0 && <ul className="divide-y rounded-lg border">{open.map(row)}</ul>}

      {passed.length > 0 && (
        <details className="group rounded-lg border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-3 text-[13px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <Dot tone="pass" />
            <span className="flex-1">
              {passed.length} {passed.length === 1 ? "check" : "checks"} passed
            </span>
            <ChevronDown className="size-4 text-subtle-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y border-t">{passed.map(row)}</ul>
        </details>
      )}
    </>
  );
}

function Dot({ tone }: { tone: "pass" | "fail" }) {
  return tone === "pass" ? (
    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand text-background">
      <Check className="size-2.5" strokeWidth={3.5} />
    </span>
  ) : (
    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-destructive text-white">
      <Minus className="size-2.5" strokeWidth={3.5} />
    </span>
  );
}

/** Edit a flagged line right here when it stands on one fact; otherwise send the person to My facts. */
function FixLink({ quote, fixHref, editHere, canEditHere }: { quote: string; fixHref: (q: string) => string; editHere: (q: string) => void; canEditHere: (q: string) => boolean }) {
  return canEditHere(quote) ? (
    <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => editHere(quote)}>
      Edit here
    </button>
  ) : (
    <Link href={fixHref(quote)} className="font-medium underline-offset-2 hover:underline">
      Fix in My experience
    </Link>
  );
}

/**
 * The inline editor. It edits the fact behind the line, in the person's words, and
 * only on an explicit "this is true". Saving rebuilds the page and reruns the review.
 */
function EditLine({ jobId, line, onClose }: { jobId: string; line: TailorResumeView["lines"][number] | undefined; onClose: () => void }) {
  const router = useRouter();
  // Start from the person's own words when the line is one of their facts; otherwise from the line itself.
  const original = line?.factText ?? line?.text.replace(/^- /, "") ?? "";
  const [text, setText] = useState(original);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const bulletId = line?.bulletId;
  if (!bulletId) return null;

  const save = () =>
    startSave(async () => {
      setError(null);
      if (!confirmed) return;
      const result = await editLineAction({ jobId, bulletId, text, confirmed }).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(result.gate.passed ? "Saved. Your resume is ready to download." : "Saved. See the checks for what's left.");
      onClose();
      router.refresh();
    });

  return (
    <form
      className="mx-auto mb-4 max-w-[680px] rounded-xl border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor="edit-line" className="text-[13.5px] font-medium">
        Edit this line
      </label>
      <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">
        Your edit is saved to My experience in your words and used on every resume from now on. Add a number only if you could explain it in an interview.
      </p>
      <Textarea id="edit-line" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={400} autoFocus className="mt-2 text-[14px] leading-6" />
      <ConfirmBox checked={confirmed} onChange={setConfirmed} className="mt-2" />
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-pending-ink">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving || !confirmed || text.trim().length < 3 || text.trim() === original}>
          {saving ? <LoaderCircle className="animate-spin" /> : <Check data-icon="inline-start" />}
          Save, it&apos;s true
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * An optional link for recruiters that shows the confirmed fact behind every line.
 * Offered only once the review passes; stopping it takes effect at once.
 */
function ProofLink({ resumeId, slug }: { resumeId: string; slug: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [origin, setOrigin] = useState("");
  // Known only in the browser; set after mount so server and client markup match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOrigin(window.location.origin), []);
  const url = slug && origin ? `${origin}/proof/${slug}` : "";

  const create = () =>
    start(async () => {
      const result = await shareResumeAction(resumeId).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  const stop = () =>
    start(async () => {
      await stopSharingAction(resumeId);
      toast("The link no longer works.");
      router.refresh();
    });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Copied. Paste it into an application's website field or your cover letter.");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  };

  return (
    <div className="mt-3 rounded-xl border px-4 py-3 text-[13.5px] leading-5">
      {slug ? (
        <>
          <p>
            <span className="font-medium">Share link on.</span>{" "}
            <span className="text-muted-foreground">Anyone with it can see each line and what you confirmed behind it. Your email and phone stay off it.</span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className="h-8 min-w-0 flex-1 rounded-md border bg-muted/40 px-2.5 font-mono text-[12px]" />
            <Button size="sm" variant="outline" onClick={copy} disabled={!url}>
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={stop} disabled={pending}>
              Stop sharing
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            <span className="font-medium">Show your work.</span>{" "}
            <span className="text-muted-foreground">A link for recruiters that shows what&apos;s behind every line.</span>
          </span>
          <Button size="sm" variant="outline" onClick={create} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Make a share link
          </Button>
        </div>
      )}
    </div>
  );
}
