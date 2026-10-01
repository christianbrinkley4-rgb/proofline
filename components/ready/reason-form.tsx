"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addReasonAction } from "@/app/app/ready/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * The one part of the cover letter Proofline will not write: why this person wants
 * this job. It goes into the letter exactly as typed, and the letter is reviewed
 * again as soon as it is saved.
 */
export function ReasonForm({ runId, company }: { runId: string; company: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await addReasonAction(runId, text);
      if (!result.ok) return void setError(result.error);
      if (result.status === "ready") toast(`Ready. The resume and the cover letter for ${company} both passed review.`);
      else setError(result.reason);
    });

  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor={`reason-${runId}`} className="text-[13px] font-medium">
        Why do you want this job?
      </Label>
      <p id={`reason-hint-${runId}`} className="text-[13px] leading-5 text-muted-foreground">
        One or two sentences in your own words. Name something real: a product you use, a team, or work {company} does that you care about. Proofline won&apos;t write this part for you.
      </p>
      <Textarea
        id={`reason-${runId}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-describedby={error ? `reason-hint-${runId} reason-error-${runId}` : `reason-hint-${runId}`}
        aria-invalid={error ? true : undefined}
        maxLength={600}
        rows={3}
        disabled={pending}
      />
      {error && (
        <p id={`reason-error-${runId}`} role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" size="sm" disabled={pending || text.trim().length === 0} aria-busy={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Checking the letter" : "Save and check the letter"}
        </Button>
      </div>
    </form>
  );
}
