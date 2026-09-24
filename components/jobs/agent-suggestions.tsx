"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { answerSuggestionAction } from "@/app/app/jobs/actions";
import { Button } from "@/components/ui/button";

export type SuggestionView = { key: string; question: string; because: string };

/** Patterns the agent noticed in what the student passes on. Nothing changes until they say yes. */
export function AgentSuggestions({ suggestions }: { suggestions: SuggestionView[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const shown = suggestions.filter((s) => !hidden.has(s.key));
  if (!shown.length) return null;

  const answer = (key: string, accept: boolean) => {
    setHidden((h) => new Set(h).add(key));
    startTransition(async () => {
      const result = await answerSuggestionAction(key, accept);
      if (accept) toast(result.ok ? "Updated your preferences. Your next search uses them." : "That suggestion is out of date.");
      router.refresh();
    });
  };

  return (
    <div className="mb-4 space-y-2">
      {shown.map((s) => (
        <div key={s.key} className="flex flex-wrap items-center gap-3 rounded-xl border bg-background px-4 py-3">
          <Sparkles className="size-4 shrink-0 text-brand" />
          <p className="min-w-0 flex-1 text-[13px]">
            <span className="font-medium">{s.question}</span> <span className="text-muted-foreground">{s.because}</span>
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" disabled={pending} onClick={() => answer(s.key, true)}>
              Yes
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => answer(s.key, false)}>
              No thanks
            </Button>
          </div>
        </div>
      ))}
      <p className="px-1 text-[11.5px] text-subtle-foreground">Learned from the jobs you passed on. Change these any time in your goals.</p>
    </div>
  );
}
