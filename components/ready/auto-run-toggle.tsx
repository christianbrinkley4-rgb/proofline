"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setAutoRunAction } from "@/app/app/ready/actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Opt in to the morning run. Off until the person turns it on, and they can turn it off any time. */
export function AutoRunToggle({ initial, mail }: { initial: boolean; mail: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) =>
    startTransition(async () => {
      setError(null);
      setOn(next);
      const result = await setAutoRunAction(next);
      if (!result.ok) {
        setOn(!next);
        return void setError(result.error);
      }
      toast(next ? "Morning run is on. The first one is tomorrow morning." : "Morning run is off.");
    });

  return (
    <div className="mt-6 max-w-2xl rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <Switch id="auto-run" checked={on} onCheckedChange={change} disabled={pending} aria-describedby="auto-run-hint" className="mt-0.5" />
        <div className="min-w-0">
          <Label htmlFor="auto-run" className="text-[14px] font-medium">
            Run this for me every morning
          </Label>
          <p id="auto-run-hint" className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Proofline looks for open jobs each morning, builds the resume and cover letter from your confirmed facts, and puts what passes review here. It checks up to 3 jobs a run and 9 a day, and it never applies for you.
            {mail ? " You get one short email when something is ready." : ""}
          </p>
          {error && (
            <p role="alert" className="mt-1 text-[13px] text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
