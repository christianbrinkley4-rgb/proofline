"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, LoaderCircle, Sparkle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAnswerAction, draftAnswerAction, saveAnswerAction } from "@/app/app/jobs/[id]/packet/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationAnswer } from "@/lib/packet/answers";
import { cn } from "@/lib/utils";
import type { SourceView } from "./cover-letter-editor";

const PLACEHOLDER = /\[[^\]]{8,}\]/;
const count = (text: string) => text.split(/\s+/).filter(Boolean).length;

const EXAMPLES = ["Why are you interested in this role?", "Describe a time you solved a problem at work.", "What experience do you have with Excel?"];

export function ApplicationAnswers({ jobId, answers, sources, canDraft }: { jobId: string; answers: ApplicationAnswer[]; sources: Record<string, SourceView>; canDraft: boolean }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          const words = limit.trim() ? Number(limit) : null;
          if (words != null && (!Number.isInteger(words) || words < 20 || words > 1000)) {
            setError("Word limits go from 20 to 1,000.");
            return;
          }
          startTransition(async () => {
            const result = await draftAnswerAction(jobId, question, words);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setQuestion("");
            setLimit("");
            router.refresh();
          });
        }}
      >
        <label className="block space-y-1.5 text-[12.5px]">
          <span>Paste a question from the application</span>
          <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={1000} placeholder={EXAMPLES[0]} />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1.5 text-[12.5px]">
            <span>Word limit <span className="text-muted-foreground">(optional)</span></span>
            <Input value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="w-28" placeholder="150" />
          </label>
          <Button type="submit" disabled={pending || !canDraft || question.trim().length < 5}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Sparkle data-icon="inline-start" />}
            Draft an answer
          </Button>
        </div>
        {error && <p role="alert" className="text-[12.5px] text-destructive">{error}</p>}
        {!answers.length && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {EXAMPLES.map((q) => (
              <button key={q} type="button" onClick={() => setQuestion(q)} className="rounded-full border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground">
                {q}
              </button>
            ))}
          </div>
        )}
      </form>

      {answers.length > 0 && (
        <ul className="space-y-3">
          {[...answers].reverse().map((a) => (
            <AnswerCard key={a.id} jobId={jobId} answer={a} sources={sources} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AnswerCard({ jobId, answer, sources }: { jobId: string; answer: ApplicationAnswer; sources: Record<string, SourceView> }) {
  const router = useRouter();
  const [text, setText] = useState(answer.answer);
  const [saved, setSaved] = useState(answer.answer);
  const [pending, startTransition] = useTransition();
  const words = count(text);
  const over = answer.wordLimit != null && words > answer.wordLimit;
  const needsYou = PLACEHOLDER.test(text);

  return (
    <li className="rounded-lg border p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13.5px] font-medium">{answer.question}</p>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Remove this answer"
          onClick={() =>
            startTransition(async () => {
              await deleteAnswerAction(jobId, answer.id);
              router.refresh();
            })
          }
        >
          <Trash2 />
        </Button>
      </div>
      <Textarea
        aria-label={`Answer to: ${answer.question}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text === saved) return;
          startTransition(async () => {
            await saveAnswerAction(jobId, answer.id, text);
            setSaved(text);
          });
        }}
        rows={Math.max(3, Math.ceil(text.length / 90))}
        className={cn("mt-2 text-[13.5px] leading-6", needsYou && "border-pending/50 bg-pending-soft")}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className={cn("tabular-nums", over && "text-pending-ink")}>
          {words} {answer.wordLimit ? `of ${answer.wordLimit}` : ""} words
        </span>
        {needsYou && <span className="text-pending-ink">Fill in the bracketed parts in your own words.</span>}
        {answer.sourceIds.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            Based on
            {answer.sourceIds.map((id) => (
              <span key={id} title={sources[id]?.text ?? "What this came from changed or was removed."} className={cn("rounded bg-muted px-1.5 py-0.5", !sources[id] && "bg-pending-soft text-pending-ink")}>
                {sources[id] ? sources[id].org ?? "Your profile" : "Changed source"}
              </span>
            ))}
          </span>
        )}
        {pending && <LoaderCircle className="size-3 animate-spin" />}
        <Button
          size="xs"
          variant="ghost"
          className="ml-auto"
          disabled={needsYou}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            toast("Copied. Paste it into the application.");
          }}
        >
          <Copy data-icon="inline-start" />
          Copy
        </Button>
      </div>
    </li>
  );
}
