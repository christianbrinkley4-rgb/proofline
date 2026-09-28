"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, CircleAlert, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { practiceFeedbackAction, saveInterviewNoteAction } from "@/app/app/jobs/[id]/packet/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MicButton } from "@/components/voice/mic-button";
import type { PrepQuestion, QuestionCategory } from "@/lib/packet/interview";
import { WORDS_PER_MINUTE, type PracticeFeedback } from "@/lib/packet/practice";
import { cn } from "@/lib/utils";

const CATEGORY: Record<QuestionCategory, string> = {
  intro: "Opener",
  motivation: "Motivation",
  skill: "From the posting",
  behavioral: "Behavioral",
  gap: "Plan an honest answer",
};

export function InterviewPrep({ jobId, questions, notes }: { jobId: string; questions: PrepQuestion[]; notes: Record<string, string> }) {
  const [open, setOpen] = useState<string | null>(questions[0]?.id ?? null);
  const practiced = questions.filter((q) => notes[q.id]?.trim()).length;
  return (
    <div>
      <p className="text-[12.5px] text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{practiced}</span> of {questions.length} practiced. Answers stay private to you.
      </p>
      <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
        Say each answer out loud with the mic, then check it. This is for rehearsing; Proofline never listens in on a real interview.
      </p>
      <ol className="mt-3 divide-y rounded-lg border">
        {questions.map((q, i) => (
          <li key={q.id}>
            <button
              type="button"
              aria-expanded={open === q.id}
              onClick={() => setOpen(open === q.id ? null : q.id)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40"
            >
              <span className="mt-0.5 font-mono text-[11px] text-subtle-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{q.question}</span>
                <span className={cn("mt-0.5 block text-[11.5px]", q.category === "gap" ? "text-pending-ink" : "text-subtle-foreground")}>{CATEGORY[q.category]}</span>
              </span>
              {notes[q.id]?.trim() && <Check className="mt-1 size-3.5 shrink-0 text-brand" strokeWidth={2.5} aria-label="Practiced" />}
              <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open === q.id && "rotate-180")} />
            </button>
            {open === q.id && <QuestionDetail jobId={jobId} question={q} note={notes[q.id] ?? ""} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function QuestionDetail({ jobId, question: q, note }: { jobId: string; question: PrepQuestion; note: string }) {
  const [text, setText] = useState(note);
  const [saved, setSaved] = useState(note);
  const [pending, startTransition] = useTransition();
  const [checking, startCheck] = useTransition();
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const check = () =>
    startCheck(async () => {
      const result = await practiceFeedbackAction(jobId, q.id, text).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Your answer is still here; try again." }));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaved(text);
      setFeedback(result.feedback);
    });
  const save = () => {
    if (text === saved) return;
    startTransition(async () => {
      try {
        await saveInterviewNoteAction(jobId, q.id, text);
        setSaved(text);
      } catch {
        toast.error("Couldn't save your answer. It's still here; try again.");
      }
    });
  };
  return (
    <div className="space-y-4 px-4 pb-5 sm:pl-12">
      <p className="text-[12.5px] text-muted-foreground">{q.why}</p>
      {q.story && (
        <div className="rounded-lg border bg-muted/30 p-3.5">
          <p className="text-[11.5px] font-medium text-subtle-foreground">Your best story{q.story.org ? ` · ${q.story.org}` : ""}</p>
          <dl className="mt-2 space-y-1.5 text-[13px] leading-5">
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-subtle-foreground">Situation</dt>
              <dd className="text-pending-ink">In your words: what was going on, and why it mattered.</dd>
            </div>
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-subtle-foreground">What you did</dt>
              <dd>{q.story.parts.action}</dd>
            </div>
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-subtle-foreground">Result</dt>
              <dd className={cn(!q.story.parts.result && "text-pending-ink")}>{q.story.parts.result ?? "What changed because of you? Say it plainly if you don't have a number."}</dd>
            </div>
          </dl>
        </div>
      )}
      {q.tips.length > 0 && (
        <ul className="space-y-1.5">
          {q.tips.map((tip) => (
            <li key={tip} className="flex gap-2 text-[13px] leading-5">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-border-strong" />
              {tip}
            </li>
          ))}
        </ul>
      )}
      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`note-${q.id}`} className="text-[12.5px] font-medium">
            Practice your answer
          </label>
          <MicButton label="Answer out loud" onText={(said) => setText((prev) => (prev.trim() ? `${prev.trim()} ${said}` : said))} />
        </div>
        <Textarea
          id={`note-${q.id}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          maxLength={4000}
          rows={4}
          className="mt-1.5"
          placeholder="Say it with the mic, or write it the way you'd say it. Saves when you click away."
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" variant="outline" disabled={checking || wordCount < 5} onClick={check}>
            {checking ? <LoaderCircle className="animate-spin" /> : null}
            How did that sound?
          </Button>
          {wordCount > 0 && <span className="text-[12px] text-subtle-foreground tabular-nums">About {Math.round((wordCount / WORDS_PER_MINUTE) * 60)} seconds out loud</span>}
          <span className="ml-auto text-[11.5px] text-subtle-foreground">
            {pending ? (
              <span className="inline-flex items-center gap-1">
                <LoaderCircle className="size-3 animate-spin" /> Saving
              </span>
            ) : text !== saved ? (
              "Unsaved"
            ) : saved ? (
              "Saved"
            ) : null}
          </span>
        </div>
        {feedback && <FeedbackList feedback={feedback} />}
      </div>
    </div>
  );
}

/** What to fix first, then what's already working. */
function FeedbackList({ feedback }: { feedback: PracticeFeedback }) {
  return (
    <ul aria-live="polite" className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3.5 motion-safe:animate-view-in">
      {feedback.notes.map((note) => (
        <li key={note.text} className="flex gap-2 text-[13px] leading-5">
          {note.tone === "good" ? (
            <Check className="mt-0.5 size-3.5 shrink-0 text-brand" strokeWidth={2.5} aria-label="Working" />
          ) : (
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-pending" aria-label="To fix" />
          )}
          <span>{note.text}</span>
        </li>
      ))}
    </ul>
  );
}
