"use client";

import { useTransition } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { dismissRunFailureAction } from "@/app/app/ready/actions";
import { Button } from "@/components/ui/button";

/**
 * The record of a run that stopped. It stays until the person dismisses it or a later
 * run gets through, so the code outlives the toast that first showed it.
 */
export function RunFailureNotice({ code, morning }: { code: string; morning: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <section aria-labelledby="run-failure-heading" className="mt-6 max-w-2xl rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="run-failure-heading" className="text-[14px] font-semibold">
            {morning ? "Your morning run stopped before it finished" : "The last run stopped before it finished"}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Something went wrong on our side. Anything that finished is saved below. The error code is <span className="font-mono font-medium whitespace-nowrap text-foreground select-all">{code}</span>.
          </p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">Try again in a minute. If it stops again, use Send feedback and include the code, so we can find exactly what happened.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => startTransition(async () => void (await dismissRunFailureAction()))} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Dismiss
          </Button>
        </div>
      </div>
    </section>
  );
}
