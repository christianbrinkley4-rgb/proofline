"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { recheckRunAction } from "@/app/app/ready/actions";
import { Button } from "@/components/ui/button";

/** For a role that stopped on something the person can fix: runs it again from the top. */
export function RecheckButton({ runId, company }: { runId: string; company: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const check = () =>
    startTransition(async () => {
      setError(null);
      const result = await recheckRunAction(runId);
      if (!result.ok) return void setError(result.error);
      if (result.status === "ready") toast(`Ready. The resume and the cover letter for ${company} both passed review.`);
      else if (result.status === "skipped") toast(result.reason ?? `${company} took this posting down.`);
      else if (result.reason) setError(result.reason);
    });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={check} disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <RotateCw />}
        {pending ? "Checking again" : "Check again"}
      </Button>
      {error && (
        <p role="alert" className="basis-full text-[13px] text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
