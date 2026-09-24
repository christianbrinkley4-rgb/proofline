"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, CircleAlert, Download, Minus, Scissors, SquareKanban } from "lucide-react";
import { toast } from "sonner";
import { trackJobAction } from "@/app/app/tracker/actions";
import { Button } from "@/components/ui/button";
import { blockingExportMessage, downloadExport, isBlockingFail } from "@/lib/export-download";
import type { TemplateId, VariantId } from "@/lib/resume/document";
import { VARIANT_BLURB, VARIANT_LABEL } from "@/lib/resume/document";
import type { DrawOp } from "@/lib/resume/layout";
import type { QualityCheck } from "@/lib/resume/quality";
import type { CutItem, WhyItem } from "@/lib/resume/tailor";
import type { Template } from "@/lib/resume/templates";
import { cn } from "@/lib/utils";
import { PagePreview } from "./page-preview";

type Panel = "why" | "cut" | "checks";

export function ResumeWorkspace({
  resumeId,
  jobId,
  ops,
  family,
  why,
  cuts,
  checks,
  adjustments,
  variant,
  template,
  blocked,
}: {
  resumeId: string;
  jobId: string | null;
  ops: DrawOp[];
  family: Template["family"];
  why: WhyItem[];
  cuts: CutItem[];
  checks: QualityCheck[];
  adjustments: string[];
  variant: VariantId;
  template: TemplateId;
  blocked: boolean;
}) {
  const [panel, setPanel] = useState<Panel>("why");
  const [hovered, setHovered] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const passed = checks.filter((c) => c.status === "pass").length;
  const blockers = checks.filter(isBlockingFail);
  const warns = checks.filter((c) => !c.blocking && c.status === "warn");
  const blockHint = blockers.length ? blockingExportMessage(blockers) : null;
  const retailor = (next: { variant?: VariantId; template?: TemplateId }) =>
    `/app/resumes/new?${new URLSearchParams({ ...(jobId ? { job: jobId } : {}), variant: next.variant ?? variant, template: next.template ?? template })}`;

  const onDownload = async (format: "pdf" | "docx") => {
    setDownloading(format);
    try {
      const result = await downloadExport(`/api/resumes/${resumeId}/${format}`, `Resume.${format}`);
      if (!result.ok) {
        toast.error(result.message);
        if (result.kind === "blocked") setPanel("checks");
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-background p-0.5" role="group" aria-label="Strategy">
          {(Object.keys(VARIANT_LABEL) as VariantId[]).map((v) => (
            <Link
              key={v}
              href={retailor({ variant: v })}
              prefetch={false}
              title={VARIANT_BLURB[v]}
              aria-current={v === variant ? "true" : undefined}
              className={cn("rounded-md px-2.5 py-1 text-[12.5px] transition-colors", v === variant ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {VARIANT_LABEL[v]}
            </Link>
          ))}
        </div>
        <div className="flex rounded-lg border bg-background p-0.5" role="group" aria-label="Template">
          {(["classic", "technical"] as const).map((t) => (
            <Link
              key={t}
              href={retailor({ template: t })}
              prefetch={false}
              aria-current={t === template ? "true" : undefined}
              className={cn("rounded-md px-2.5 py-1 text-[12.5px] capitalize transition-colors", t === template ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {t}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {blocked && blockHint && (
            <button type="button" onClick={() => setPanel("checks")} className="max-w-[18rem] text-left text-[12.5px] text-pending-ink hover:underline">
              {blockHint}
            </button>
          )}
          {!blocked && warns.length > 0 && (
            <span className="text-[12.5px] text-muted-foreground">Style warnings won&apos;t block export</span>
          )}
          {(["pdf", "docx"] as const).map((format) => (
            <Button
              key={format}
              variant={format === "pdf" && !blocked ? "default" : "outline"}
              size="sm"
              disabled={blocked || downloading !== null}
              onClick={() => onDownload(format)}
            >
              <Download data-icon="inline-start" />
              {format.toUpperCase()}
            </Button>
          ))}
          {jobId && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await trackJobAction(jobId, resumeId);
                    toast("Tracked with this resume version.");
                  } catch {
                    toast.error("Could not attach this version. Check your tracker; sent versions stay attached after applying.");
                  }
                })
              }
            >
              <SquareKanban data-icon="inline-start" />
              Track with this version
            </Button>
          )}
        </div>
      </div>
      {jobId && <Link href={`/app/resumes/compare?job=${jobId}`} className="mt-2 inline-block text-[12.5px] underline underline-offset-2">Compare all versions for this job</Link>}
      <p className="mt-2 text-[12.5px] text-muted-foreground">{VARIANT_BLURB[variant]}</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-xl border bg-muted/60 p-3 sm:p-6" onMouseLeave={() => setHovered(null)}>
          <div
            className="mx-auto max-w-[680px] shadow-[0_1px_3px_rgb(0_0_0/0.08),0_12px_32px_-16px_rgb(0_0_0/0.18)]"
            onMouseOver={(e) => {
              const ref = (e.target as Element).getAttribute?.("data-ref");
              if (ref) setHovered(ref);
            }}
          >
            <PagePreview ops={ops} family={family} hovered={hovered} />
          </div>
          <p className="mt-3 text-center text-[12px] text-subtle-foreground">
            This is the exact page: same layout, same line breaks as the PDF. Hover a bullet to see why it&apos;s there.
          </p>
        </div>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background lg:max-h-[calc(100dvh-8rem)] lg:sticky lg:top-6">
          <div role="tablist" aria-label="Resume reasoning" className="flex gap-1 border-b p-2">
            {(
              [
                ["why", "Why this works"],
                ["cut", `What I cut (${cuts.length})`],
                ["checks", `Checks ${passed}/${checks.length}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={panel === id}
                onClick={() => setPanel(id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors",
                  panel === id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="scroll-thin space-y-2.5 overflow-y-auto p-3">
            {panel === "why" &&
              why.map((w) => (
                <div
                  key={w.bulletId}
                  onMouseEnter={() => setHovered(w.bulletId)}
                  onMouseLeave={() => setHovered(null)}
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
                <p className="px-1 text-[12.5px] leading-5 text-muted-foreground">
                  See what stayed off this version and why. Some lines need your confirmation; others were a weaker match or did not fit on the page.
                </p>
                {adjustments.map((a) => (
                  <div key={a} className="rounded-lg border border-dashed p-3 text-[12.5px] text-muted-foreground">
                    {a}
                  </div>
                ))}
                {cuts.length === 0 && <p className="px-1 text-[13px]">Nothing was cut. Everything fit.</p>}
                {cuts.map((c, i) => (
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

            {panel === "checks" && (
              <ul className="divide-y rounded-lg border">
                {checks.map((c) => (
                  <li key={c.id} className="flex gap-2.5 p-3">
                    {c.status === "pass" ? (
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand text-white">
                        <Check className="size-2.5" strokeWidth={3.5} />
                      </span>
                    ) : c.status === "warn" ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-pending" />
                    ) : (
                      <Minus className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    <div>
                      <div className="text-[13px] font-medium">
                        {c.label}
                        {c.blocking && c.status === "fail" && <span className="ml-1.5 text-[11px] font-normal text-destructive">blocks export</span>}
                      </div>
                      <div className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">{c.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
