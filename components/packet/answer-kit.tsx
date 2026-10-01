"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleAlert, Copy, FileText, LoaderCircle, Sparkle } from "lucide-react";
import { toast } from "sonner";
import { markSubmittedAction } from "@/app/app/jobs/[id]/kit/actions";
import { draftAnswerAction } from "@/app/app/jobs/[id]/packet/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { KitField, KitGroup, KitSource } from "@/lib/packet/kit";
import { cn } from "@/lib/utils";

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied ${label.toLowerCase()}.`);
  } catch {
    toast("Your browser blocked copying. Select the text and copy it instead.");
  }
}

function Sources({ sources, value }: { sources: KitSource[]; value: string }) {
  const facts = sources.filter((s): s is Extract<KitSource, { kind: "fact" }> => s.kind === "fact");
  const other = sources.filter((s) => s.kind !== "fact");
  // A field that is exactly one confirmed fact doesn't need the fact repeated under it.
  const same = facts.length === 1 && facts[0].text.trim() === value.trim();
  return (
    <div className="mt-1.5 space-y-1 text-[12px] leading-5 text-subtle-foreground">
      {same && (
        <p className="flex items-center gap-1">
          <Check className="size-3 text-brand" aria-hidden />
          Confirmed fact
        </p>
      )}
      {!same && facts.length > 0 && (
        <div>
          <p className="flex items-center gap-1">
            <Check className="size-3 text-brand" aria-hidden />
            From {facts.length === 1 ? "one thing you confirmed" : `${facts.length} things you confirmed`}
          </p>
          <ul className="mt-0.5 space-y-0.5 border-l-2 border-brand/30 pl-2.5">
            {facts.slice(0, 6).map((s) => (
              <li key={s.id} className="line-clamp-2 text-muted-foreground">&ldquo;{s.text}&rdquo;</li>
            ))}
            {facts.length > 6 && <li>and {facts.length - 6} more</li>}
          </ul>
        </div>
      )}
      {other.map((s) => (
        <p key={s.label} className="flex items-center gap-1">
          <Check className="size-3 text-brand" aria-hidden />
          From {s.label.charAt(0).toLowerCase() + s.label.slice(1)}
        </p>
      ))}
    </div>
  );
}

function FieldRow({ field, readOnly }: { field: KitField; readOnly: boolean }) {
  if (field.blank) {
    return (
      <li className="rounded-xl border border-pending/40 bg-pending-soft/60 px-3.5 py-3">
        <p className="text-[12.5px] font-medium text-pending-ink">{field.label}</p>
        <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-5 text-pending-ink">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Left blank. {field.blank.reason}
          </span>
        </p>
        {!readOnly && (
          <Link href={field.blank.fix.href} className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-[12.5px] font-medium text-foreground hover:underline">
            {field.blank.fix.label}
            <ArrowRight className="size-3" />
          </Link>
        )}
      </li>
    );
  }
  return (
    <li className="rounded-xl border px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[12.5px] font-medium text-muted-foreground">{field.label}</p>
        {!readOnly && !field.file && (
          <Button
            size="xs"
            variant="outline"
            className="shrink-0"
            disabled={Boolean(field.unfinished)}
            aria-label={`Copy ${field.label}`}
            onClick={() => copy(field.value, field.label)}
          >
            <Copy data-icon="inline-start" />
            Copy
          </Button>
        )}
        {!readOnly && field.file && (
          <Button size="xs" variant="outline" className="shrink-0" asChild>
            <Link href={field.file.href}>
              <FileText data-icon="inline-start" />
              Get the PDF
            </Link>
          </Button>
        )}
      </div>
      <p className={cn("mt-1 text-[14px] leading-6 break-words", field.multiline && "whitespace-pre-wrap")}>{field.value}</p>
      {field.unfinished && <p className="mt-1 text-[12.5px] text-pending-ink">{field.unfinished}</p>}
      <Sources sources={field.sources} value={field.value} />
    </li>
  );
}

export function KitGroups({ groups, readOnly = false, jobId, canDraft = false }: { groups: KitGroup[]; readOnly?: boolean; jobId?: string; canDraft?: boolean }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key} id={`kit-${group.key}`} aria-labelledby={`kit-${group.key}-title`} className="scroll-mt-20 rounded-2xl border bg-background p-4 sm:p-5">
          <h2 id={`kit-${group.key}-title`} className="text-[16px] font-semibold">{group.title}</h2>
          {group.note && <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{group.note}</p>}
          <div className="mt-3 space-y-4">
            {group.entries.map((entry) => (
              <div key={entry.key}>
                {entry.heading && <h3 className="mb-2 text-[13.5px] font-medium">{entry.heading}</h3>}
                <ul className="grid gap-2">
                  {entry.fields.map((f) => <FieldRow key={f.key} field={f} readOnly={readOnly} />)}
                </ul>
              </div>
            ))}
          </div>
          {group.key === "questions" && !readOnly && jobId && <AddQuestion jobId={jobId} canDraft={canDraft} />}
        </section>
      ))}
    </div>
  );
}

function AddQuestion({ jobId, canDraft }: { jobId: string; canDraft: boolean }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-4 space-y-2 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        startTransition(async () => {
          const result = await draftAnswerAction(jobId, question, null);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setQuestion("");
          router.refresh();
        });
      }}
    >
      <label className="block space-y-1.5 text-[12.5px]">
        <span>Paste another question from the form</span>
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={1000} placeholder="What experience do you have with Excel?" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending || !canDraft || question.trim().length < 5}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Sparkle data-icon="inline-start" />}
          Draft from my facts
        </Button>
        <Link href={`/app/jobs/${jobId}/packet#questions`} className="text-[12.5px] text-muted-foreground hover:text-foreground hover:underline">
          Edit answers on the packet page
        </Link>
      </div>
      {!canDraft && <p className="text-[12.5px] text-muted-foreground">Drafting needs the full posting. Paste it on Today first.</p>}
      {error && <p role="alert" className="text-[12.5px] text-destructive">{error}</p>}
    </form>
  );
}

export function MarkSubmitted({ jobId, digest, company }: { jobId: string; digest: string; company: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(""); }}>
      <DialogTrigger asChild>
        <Button size="xl">
          <Check data-icon="inline-start" />
          Mark submitted
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold">Did you submit it on {company}&apos;s site?</DialogTitle>
          <DialogDescription className="text-[13.5px] leading-6">
            Proofline keeps an exact copy of this kit as what you sent, moves the job to Applied, and reminds you to follow up in 14 days. Mark it only after you pressed submit on their form.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="rounded-lg bg-pending-soft px-3 py-2 text-[13px] leading-5 text-pending-ink">{error}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="lg" autoFocus>
              Not yet
            </Button>
          </DialogClose>
          <Button
            size="lg"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await markSubmittedAction(jobId, digest);
                if (result.ok) {
                  setOpen(false);
                  toast("Saved as sent. It's in your tracker as Applied.");
                  router.refresh();
                  return;
                }
                if (result.reason === "stale") {
                  setError("Your experience changed since this page opened, so these answers changed too. Close this, check the updated answers, then mark it again.");
                  router.refresh();
                  return;
                }
                setError("This application already has a saved record of what you sent.");
                router.refresh();
              })
            }
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Yes, I submitted it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
