"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Check, LoaderCircle, MessageSquareText } from "lucide-react";
import { submitFeedbackAction } from "@/app/app/feedback/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Kind = "resume" | "cover_letter" | "career_plan";

const SUBJECT: Record<Kind, string> = {
  resume: "this resume",
  cover_letter: "this cover letter",
  career_plan: "this plan",
};

const RATINGS = [
  { value: "helpful", label: "Helpful" },
  { value: "partly_helpful", label: "Partly helpful" },
  { value: "not_helpful", label: "Not helpful" },
] as const;

const ISSUES: ReadonlyArray<{ value: string; label: string; kinds?: Kind[] }> = [
  { value: "unsupported_claim", label: "It says something I didn't do" },
  { value: "generic", label: "Too generic" },
  { value: "irrelevant", label: "Not relevant to what I want", kinds: ["resume", "cover_letter"] },
  { value: "unrealistic_step", label: "A step isn't realistic for me", kinds: ["career_plan"] },
  { value: "hard_to_use", label: "Hard to use" },
  { value: "other", label: "Something else" },
];

/**
 * An optional, low-key rating for one output. Nothing is sent until the person
 * presses Send, and improvement consent stays off unless they tick it.
 */
export function FeedbackControl({ kind, subjectId, className }: { kind: Kind; subjectId: string; className?: string }) {
  const id = useId();
  const [rating, setRating] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await submitFeedbackAction(form);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  if (status === "saved") {
    return (
      <div role="status" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-background px-4 py-3 text-[13px]", className)}>
        <span className="flex items-center gap-1.5 font-medium">
          <Check className="size-4 text-brand" strokeWidth={2.5} />
          Thanks. Your feedback is saved.
        </span>
        <button
          type="button"
          onClick={() => {
            setRating(null);
            setStatus("idle");
          }}
          className="py-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Send more
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn("rounded-xl border bg-background px-4 py-3", className)}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <fieldset>
        <legend className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <MessageSquareText className="size-3.5" />
          Was {SUBJECT[kind]} useful? <span className="text-subtle-foreground">(optional)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RATINGS.map((r) => (
            <label
              key={r.value}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-[13px] transition-colors hover:border-border-strong",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
                rating === r.value && "border-foreground bg-foreground text-background hover:border-foreground",
              )}
            >
              <input
                type="radio"
                name="rating"
                value={r.value}
                required
                checked={rating === r.value}
                onChange={() => setRating(r.value)}
                className="sr-only"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      {rating && (
        <div className="mt-3 grid gap-3 motion-safe:animate-view-in">
          <label htmlFor={`${id}-issue`} className="grid gap-1.5 text-[12.5px] font-medium">
            What was off? <span className="sr-only">(optional)</span>
            <select
              id={`${id}-issue`}
              name="issue"
              defaultValue=""
              className="h-9 w-full rounded-md border bg-background px-2 text-[13.5px] font-normal sm:max-w-xs"
            >
              <option value="">Nothing specific</option>
              {ISSUES.filter((i) => !i.kinds || i.kinds.includes(kind)).map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-comment`} className="grid gap-1.5 text-[12.5px] font-medium">
            <span>
              Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <textarea
              id={`${id}-comment`}
              name="comment"
              rows={2}
              maxLength={1000}
              className="w-full rounded-md border bg-background px-3 py-2 text-[13.5px] font-normal"
            />
          </label>
          <label className="flex items-start gap-2 text-[12.5px] leading-5 text-muted-foreground">
            <input type="checkbox" name="consentToImprove" className="mt-0.5 size-4 shrink-0 accent-foreground" />
            <span>
              Allow Proofline to use this feedback to improve the product for others.{" "}
              <span className="text-subtle-foreground">Leave it unchecked and only your account can use it for your own revisions.</span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              Send feedback
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setRating(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status === "error" && (
        <p role="alert" className="mt-2 text-[12.5px] text-destructive">
          Couldn&apos;t save your feedback. Try again in a moment.
        </p>
      )}
    </form>
  );
}
