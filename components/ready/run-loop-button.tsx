"use client";

import { useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { runLoopAction } from "@/app/app/ready/actions";
import { Button } from "@/components/ui/button";
import { summaryMessage } from "./summary";

export function RunLoopButton({ disabled, label = "Find 3 ready to apply" }: { disabled?: boolean; label?: string }) {
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const result = await runLoopAction();
      if (!result.ok) return void toast.error(result.error);
      toast(summaryMessage(result.summary), { duration: 10000 });
    });
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button size="xl" onClick={run} disabled={disabled || pending} aria-busy={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Search />}
        {pending ? "Checking jobs" : label}
      </Button>
      {pending && (
        <p role="status" className="text-[13px] text-muted-foreground">
          Confirming each posting is open, building the resumes, and running the review. This takes about a minute.
        </p>
      )}
    </div>
  );
}
