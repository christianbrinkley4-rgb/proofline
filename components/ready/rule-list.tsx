"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { removeRuleAction } from "@/app/app/ready/actions";
import type { Rule } from "@/lib/agent/rules";

export function RuleList({ rules }: { rules: Rule[] }) {
  const [pending, startTransition] = useTransition();
  const remove = (rule: Rule) =>
    startTransition(async () => {
      try {
        await removeRuleAction(rule.raw);
        toast(`Removed. ${rule.label} can show up again.`);
      } catch {
        toast.error("Couldn't remove that. Try again.");
      }
    });
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {rules.map((rule) => (
        <li key={rule.raw} className="inline-flex min-h-8 items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-3 text-[13px]">
          {rule.label}
          <button
            type="button"
            onClick={() => remove(rule)}
            disabled={pending}
            aria-label={`Remove rule: ${rule.label}`}
            className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
