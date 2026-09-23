"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { MatchChip } from "@/components/shared/fit";
import type { ComponentDetail } from "@/lib/fit/engine";
import { FIT_COMPONENTS, type FitComponentKey, type FitPoints } from "@/lib/fit/rubric";
import { cn } from "@/lib/utils";

/** The six-part breakdown: every point is explained, with what matched and what's missing. */
export function FitBreakdown({ points, details }: { points: FitPoints; details: Record<FitComponentKey, ComponentDetail> }) {
  const [open, setOpen] = useState<FitComponentKey | null>("requiredSkills");
  return (
    <ul className="divide-y">
      {FIT_COMPONENTS.map(({ key, label, max }) => {
        const pts = points[key] ?? 0;
        const detail = details[key];
        const expanded = open === key;
        const hasChips = detail && (detail.matched.length > 0 || detail.missing.length > 0);
        return (
          <li key={key}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : key)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 sm:px-5"
            >
              <span className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] font-medium">
                  <ChevronDown className={cn("size-3.5 shrink-0 text-subtle-foreground transition-transform", !expanded && "-rotate-90")} />
                  <span className="truncate">{label}</span>
                </span>
                <span className="hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-muted sm:block lg:w-40">
                  <span className="block h-full origin-left rounded-full bg-brand motion-safe:animate-bar-grow" style={{ width: `${(pts / max) * 100}%` }} />
                </span>
                <span className="w-12 shrink-0 text-right text-[13.5px] tabular-nums">
                  <span className="font-semibold">{pts}</span>
                  <span className="text-subtle-foreground">/{max}</span>
                </span>
              </span>
              {detail?.note && <span className="mt-1 block pl-5 text-[13px] leading-5 text-muted-foreground">{detail.note}</span>}
            </button>
            {expanded && hasChips && (
              <div className="flex flex-wrap gap-1.5 px-4 pt-0.5 pb-4 pl-9 sm:px-5 sm:pl-10">
                {detail.matched.map((m) => (
                  <MatchChip key={`m-${m}`} matched>
                    {m}
                  </MatchChip>
                ))}
                {detail.missing.map((m) => (
                  <MatchChip key={`x-${m}`} matched={false}>
                    {m}
                  </MatchChip>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
