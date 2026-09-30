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
      {resume.canExport && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-soft/40 px-4 py-3 text-[13.5px] leading-5">
          <span>
            <span className="font-medium">Resume ready.</span> <span className="text-muted-foreground">Next, a cover letter and interview prep built from the same facts.</span>
          </span>
          <Button size="sm" variant="outline" className="bg-background" asChild>
            <Link href={`/app/jobs/${jobId}/packet`}>
              Cover letter and prep
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      )}
      {resume.canExport && <ProofLink resumeId={resume.resumeId} slug={resume.shareSlug} />}
      {!resume.canExport && resume.reason && (
        <p id="export-lock" className="mt-2 flex items-start gap-1.5 text-[13px] text-pending-ink">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Downloads unlock when the review passes. {resume.reason}
        </p>
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
            The exact page, same line breaks as the PDF. Version {resume.version}.{flagged.size > 0 && " Highlighted lines need a fix."} Select any bullet to edit it.
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
      Fix in My facts
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
      toast(result.gate.passed ? "Saved and rebuilt. Review passed." : "Saved and rebuilt. See the review for what's left.");
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
        Your edit is saved to My facts in your words and used on every resume from now on. Add a number only if you could explain it in an interview.
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
          Save and rebuild
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
            <span className="font-medium">Proof link on.</span>{" "}
            <span className="text-muted-foreground">Anyone with it can see each line and the fact you confirmed behind it. Your email and phone stay off it.</span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <input readOnly value={url} aria-label="Proof link" onFocus={(e) => e.currentTarget.select()} className="h-8 min-w-0 flex-1 rounded-md border bg-muted/40 px-2.5 font-mono text-[12px]" />
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
            <span className="text-muted-foreground">A link for recruiters with the confirmed fact behind every line. Optional.</span>
          </span>
          <Button size="sm" variant="outline" onClick={create} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Create a proof link
          </Button>
        </div>
      )}
    </div>
  );
}
