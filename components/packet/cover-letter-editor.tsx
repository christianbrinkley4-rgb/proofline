"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Copy, Download, LoaderCircle, RefreshCw, Sparkle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { draftCoverLetterAction, saveCoverLetterAction, saveWhyAction } from "@/app/app/jobs/[id]/packet/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { blockingExportMessage, downloadExport, isBlockingFail } from "@/lib/export-download";
import { letterText, type CoverLetter, type LetterCheck, type LetterParagraph } from "@/lib/packet/cover-letter";
import { cn } from "@/lib/utils";

export type SourceView = { id: string; text: string; org: string | null };

const PURPOSE: Record<LetterParagraph["purpose"], string> = {
  opening: "Opening",
  evidence: "Evidence",
  fit: "Fit",
  motivation: "Why this job",
  closing: "Closing",
};

const PLACEHOLDER = /\[[^\]]{8,}\]/;

export function CoverLetterEditor({
  jobId,
  company,
  signature,
  initialLetter,
  initialWhy,
  checks,
  sources,
  canDraft,
}: {
  jobId: string;
  company: string;
  signature: string;
  initialLetter: CoverLetter | null;
  initialWhy: string;
  checks: LetterCheck[];
  sources: Record<string, SourceView>;
  canDraft: boolean;
}) {
  const router = useRouter();
  const [letter, setLetter] = useState<CoverLetter | null>(initialLetter);
  const [saved, setSaved] = useState<CoverLetter | null>(initialLetter);
  const [why, setWhy] = useState(initialWhy);
  const [savedWhy, setSavedWhy] = useState(initialWhy);
  const [confirmRedraft, setConfirmRedraft] = useState(false);
  const [pending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const dirty = JSON.stringify(letter) !== JSON.stringify(saved);
  const blockers = checks.filter(isBlockingFail);
  const warns = checks.filter((c) => !c.blocking && !c.ok);
  const blocked = blockers.length > 0;
  const blockHint = blocked ? blockingExportMessage(blockers) : null;

  const draft = () =>
    startTransition(async () => {
      try {
        const next = await draftCoverLetterAction(jobId, why);
        setLetter(next);
        setSaved(next);
        setSavedWhy(why);
        setConfirmRedraft(false);
        toast("Drafted from your confirmed evidence.");
        router.refresh();
      } catch {
        toast.error("Couldn't draft the letter. Please try again.");
      }
    });

  const save = () =>
    startTransition(async () => {
      if (!letter) return;
      try {
        const next = await saveCoverLetterAction(jobId, letter);
        setLetter(next);
        setSaved(next);
        toast("Saved. The letter is in your words now.");
        router.refresh();
      } catch {
        toast.error("Couldn't save. Your edits are still here; try again.");
      }
    });

  const saveReason = () =>
    startTransition(async () => {
      try {
        await saveWhyAction(jobId, why);
        setSavedWhy(why);
        toast(letter && letter.paragraphs.some((p) => PLACEHOLDER.test(p.text)) ? "Saved and added to your letter." : "Saved.");
        router.refresh();
      } catch {
        toast.error("Couldn't save that. Please try again.");
      }
    });

  const onDownload = async (format: "pdf" | "docx") => {
    setDownloading(format);
    try {
      const result = await downloadExport(`/api/packet/${jobId}/cover-letter/${format}`, `Cover-Letter.${format}`);
      if (!result.ok) toast.error(result.message);
    } finally {
      setDownloading(null);
    }
  };

  // A fresh draft or a server-filled placeholder should replace local state when nothing is being edited.
  if (!dirty && initialLetter && JSON.stringify(initialLetter) !== JSON.stringify(saved)) {
    setLetter(initialLetter);
    setSaved(initialLetter);
  }

  const setParagraph = (index: number, text: string) =>
    setLetter((l) => (l ? { ...l, paragraphs: l.paragraphs.map((p, i) => (i === index ? { ...p, text } : p)) } : l));

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/30 p-4">
        <label htmlFor="why" className="text-[13.5px] font-medium">
          Why {company}? <span className="font-normal text-muted-foreground">In your own words</span>
        </label>
        <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">
          Only you know this, so Proofline never writes it for you. One or two honest sentences go into the letter as written.
        </p>
        <Textarea
          id="why"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          maxLength={1200}
          rows={2}
          className="mt-2 bg-background"
          placeholder="What really draws you here? Something you've read about their work, a person you met, or how the role fits your plans."
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="outline" disabled={pending || why === savedWhy} onClick={saveReason}>
            Save reason
          </Button>
        </div>
      </div>

      {!letter ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-[14px] font-medium">No cover letter yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-5 text-muted-foreground">
            Proofline picks your strongest confirmed evidence for this posting and shows where every sentence came from.
          </p>
          <Button className="mt-4" onClick={draft} disabled={pending || !canDraft}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Sparkle data-icon="inline-start" />}
            Draft cover letter
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <Textarea
              aria-label="Greeting"
              value={letter.greeting}
              onChange={(e) => setLetter({ ...letter, greeting: e.target.value })}
              rows={1}
              className="min-h-0 resize-none"
            />
            {letter.paragraphs.map((p, i) => {
              const needsYou = PLACEHOLDER.test(p.text);
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                  <span className={cn("pt-2 font-mono text-[11px] uppercase tracking-wide", needsYou ? "text-pending-ink" : "text-subtle-foreground")}>{PURPOSE[p.purpose]}</span>
                  <div>
                    <Textarea
                      aria-label={`${PURPOSE[p.purpose]} paragraph`}
                      value={p.text}
                      onChange={(e) => setParagraph(i, e.target.value)}
                      rows={Math.max(2, Math.ceil(p.text.length / 90))}
                      className={cn("text-[14px] leading-6", needsYou && "border-pending/50 bg-pending-soft")}
                    />
                    {needsYou && p.purpose === "motivation" && (
                      <p className="mt-1.5 text-[12px] leading-5 text-pending-ink">
                        Only you can write this part. <a href="#why" className="font-medium underline underline-offset-2">Write your reason above</a> and save it, or replace the bracketed text here.
                      </p>
                    )}
                    {p.sourceIds.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <span>Based on</span>
                        {p.sourceIds.map((id) => {
                          const s = sources[id];
                          return (
                            <span key={id} title={s?.text ?? "This evidence changed or was removed."} aria-label={s ? `${s.org ?? "Your profile"}: ${s.text}` : "Changed evidence"} className={cn("rounded bg-muted px-1.5 py-0.5", !s && "bg-pending-soft text-pending-ink")}>
                              {s ? s.org ?? "Your profile" : "Changed evidence"}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="grid gap-2 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
              <span />
              <p className="text-[14px] leading-6 text-muted-foreground">
                {letter.signoff}
                <br />
                {signature}
              </p>
            </div>
          </div>

          <ul className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-2 text-[12.5px] leading-5">
                {c.ok ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-brand" strokeWidth={2.5} />
                ) : c.blocking ? (
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-pending-ink" />
                ) : (
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span>
                  <span className="font-medium">{c.label}.</span>{" "}
                  <span className="text-muted-foreground">{c.detail}</span>
                  {!c.ok && c.blocking && <span className="ml-1 text-[11px] text-pending-ink">blocks export</span>}
                  {!c.ok && !c.blocking && <span className="ml-1 text-[11px] text-muted-foreground">warning</span>}
                </span>
              </li>
            ))}
            {dirty && <li className="text-[12.5px] text-pending-ink sm:col-span-2">Unsaved edits. Checks update when you save.</li>}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={pending || !dirty}>
              {pending && dirty ? <LoaderCircle className="animate-spin" /> : null}
              Save edits
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(letterText(letter, signature));
                  toast("Copied. Paste it into the application.");
                } catch {
                  toast.error("Couldn't copy here. Download the PDF or DOCX instead.");
                }
              }}
            >
              <Copy data-icon="inline-start" />
              Copy text
            </Button>
            {(["pdf", "docx"] as const).map((format) => (
              <Button
                key={format}
                variant="outline"
                disabled={blocked || dirty || downloading !== null}
                onClick={() => onDownload(format)}
              >
                <Download data-icon="inline-start" />
                {format.toUpperCase()}
              </Button>
            ))}
            <span className="ml-auto" />
            {confirmRedraft ? (
              <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                Replace your edits with a new draft?
                <Button size="sm" variant="destructive" onClick={draft} disabled={pending || !canDraft}>
                  Redraft
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmRedraft(false)}>
                  Keep mine
                </Button>
              </span>
            ) : (
              <Button variant="ghost" onClick={() => (letter.generator === "user" || dirty ? setConfirmRedraft(true) : draft())} disabled={pending || !canDraft}>
                <RefreshCw data-icon="inline-start" />
                Redraft
              </Button>
            )}
          </div>
          {blocked && !dirty && blockHint && <p className="text-[12.5px] text-pending-ink">{blockHint}</p>}
          {!blocked && !dirty && warns.length > 0 && (
            <p className="text-[12.5px] text-muted-foreground">
              {warns.length} {warns.length === 1 ? "suggestion" : "suggestions"} to review above. Download still works.
            </p>
          )}
        </>
      )}
    </div>
  );
}
