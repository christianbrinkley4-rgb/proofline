"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardPaste, LoaderCircle } from "lucide-react";
import { importLinkAction, importPastedJobAction } from "@/app/app/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { guessPosting, isLink } from "@/lib/jobs/guess-posting";
import { cn } from "@/lib/utils";

const MIN_TEXT = 200;

/**
 * The front door: paste a link or a whole posting. A link is fetched when the site
 * allows it; otherwise the student pastes the text and confirms the title and
 * company we read from it. Either way they land on the job's knockouts and fit score.
 */
export function PasteJobBox({
  className,
  autoFocus = false,
  compact = false,
  submitLabel = "Check my fit",
  onIngested,
}: {
  className?: string;
  autoFocus?: boolean;
  compact?: boolean;
  /** What pressing go does next, in a few words. */
  submitLabel?: string;
  /** Runs instead of opening the job, e.g. to finish onboarding first. */
  onIngested?: (jobId: string) => Promise<void> | void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [link, setLink] = useState("");
  const [needsText, setNeedsText] = useState(false);
  const [edits, setEdits] = useState<{ title?: string; company?: string; location?: string }>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const asLink = isLink(trimmed);
  const asText = !asLink && trimmed.length >= MIN_TEXT;
  const guess = useMemo(() => (asText ? guessPosting(trimmed) : null), [asText, trimmed]);
  const title = edits.title ?? guess?.title ?? "";
  const company = edits.company ?? guess?.company ?? "";
  const location = edits.location ?? guess?.location ?? "";

  const open = async (jobId: string) => (onIngested ? onIngested(jobId) : router.push(`/app/jobs/${jobId}`));

  const submit = () => {
    setError("");
    if (asLink) {
      startTransition(async () => {
        const result = await importLinkAction(trimmed).catch(() => ({ ok: false as const, error: "I couldn't reach that page." }));
        if (result.ok) return open(result.jobId);
        // Sign-in walls (LinkedIn, Handshake) and blocked sites: keep the link, ask for the text.
        setLink(trimmed);
        setValue("");
        setNeedsText(true);
        // Some reasons already say to paste the text; don't say it twice.
        setError(/\bpaste\b/i.test(result.error) ? result.error : `${result.error} Copy the posting from that page and paste it here instead.`);
        textarea.current?.focus();
      });
      return;
    }
    if (!asText) {
      setError("Paste a link, or the whole posting (a few paragraphs) so there's enough to score.");
      return;
    }
    if (!title || !company) {
      setError("Add the job title and company so your resume is named right.");
      return;
    }
    startTransition(async () => {
      const result = await importPastedJobAction({ company, title, location, url: link, description: trimmed }).catch(() => ({
        ok: false as const,
        error: "Couldn't save this job. Check your connection and try again.",
      }));
      if (result.ok) return open(result.jobId);
      setError(result.error);
    });
  };

  return (
    <form
      id="paste"
      className={cn("scroll-mt-24", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="rounded-2xl border border-field bg-background p-2 shadow-xs transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
        <div className="flex items-start gap-3 px-2 pt-2">
          <ClipboardPaste className="mt-1 size-4 shrink-0 text-subtle-foreground" />
          <textarea
            ref={textarea}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setEdits({});
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && isLink(value.trim())) {
                e.preventDefault();
                submit();
              }
            }}
            autoFocus={autoFocus}
            rows={asText ? 6 : compact ? 1 : 2}
            maxLength={40000}
            aria-label="Paste a job link or the job description"
            placeholder={
              needsText
                ? "Paste the full job description here"
                : "Paste a job link (LinkedIn, Indeed, Handshake, any company site) or the whole description"
            }
            className={cn(
              "min-h-10 w-full resize-none bg-transparent py-1 text-[15px] leading-6 outline-none placeholder:text-subtle-foreground",
              // The placeholder wraps to three lines on a phone; show all of it.
              !asText && "max-sm:min-h-[4.75rem]",
            )}
          />
        </div>

        {asText && (
          <div className="mt-2 grid gap-2 border-t px-2 pt-3 sm:grid-cols-3 motion-safe:animate-view-in">
            <label className="space-y-1 text-[12px] text-muted-foreground">
              <span>Job title</span>
              <Input value={title} onChange={(e) => setEdits((x) => ({ ...x, title: e.target.value }))} maxLength={200} className="h-9 bg-background text-foreground" />
            </label>
            <label className="space-y-1 text-[12px] text-muted-foreground">
              <span>Company</span>
              <Input value={company} onChange={(e) => setEdits((x) => ({ ...x, company: e.target.value }))} maxLength={160} className="h-9 bg-background text-foreground" />
            </label>
            <label className="space-y-1 text-[12px] text-muted-foreground">
              <span>Location <span className="text-subtle-foreground">(optional)</span></span>
              <Input value={location} onChange={(e) => setEdits((x) => ({ ...x, location: e.target.value }))} maxLength={160} className="h-9 bg-background text-foreground" />
            </label>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
          <p className="text-[12px] text-subtle-foreground">
            {pending
              ? asLink
                ? "Reading the posting"
                : "Scoring your fit"
              : asText
                ? "Check the title and company I read, then go."
                : trimmed && !asLink
                  ? // The button stays off until there's enough text to score; say why.
                    `Keep going: paste the whole posting, duties and requirements included (${trimmed.length}/${MIN_TEXT} characters).`
                  : link
                  ? `Saving the link too: ${new URL(link).hostname}`
                  : "A link works, or paste the whole posting."}
          </p>
          <Button type="submit" size="lg" disabled={pending || (!asLink && !asText)}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            {submitLabel}
            {!pending && <ArrowRight data-icon="inline-end" />}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-pending-ink">
          {error}
        </p>
      )}
    </form>
  );
}
