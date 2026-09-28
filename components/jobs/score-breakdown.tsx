"use client";

import { useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import type { ComponentDetail } from "@/lib/fit/engine";
import { FIT_COMPONENTS, type FitComponentKey, type FitPoints } from "@/lib/fit/rubric";
import { cn } from "@/lib/utils";

/** The six weighted rows, adding to 100. Each opens to what matched, what's missing, and why. */
export function ScoreBreakdown({ points, details }: { points: FitPoints; details: Record<FitComponentKey, ComponentDetail> }) {
  const [open, setOpen] = useState<FitComponentKey | null>("requiredSkills");
  return (
    <ul className="divide-y">
      {FIT_COMPONENTS.map(({ key, label, max }) => {
        const pts = points[key] ?? 0;
        const detail = details[key];
        const expanded = open === key;
        const items = [...(detail?.matched ?? []).map((item) => ({ item, matched: true })), ...(detail?.missing ?? []).map((item) => ({ item, matched: false }))];
        return (
          <li key={key}>
            <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : key)} className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 sm:px-5">
              <span className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] font-medium">
                  <ChevronDown className={cn("size-3.5 shrink-0 text-subtle-foreground transition-transform", !expanded && "-rotate-90")} />
                  <span className="truncate">{label}</span>
                  <span className="shrink-0 text-[12px] font-normal text-subtle-foreground">weight {max}</span>
                </span>
                <span className="hidden h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-muted sm:block lg:w-36">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${(pts / max) * 100}%` }} />
                </span>
                <span className="w-12 shrink-0 text-right text-[13.5px] tabular-nums">
                  <span className="font-semibold">{pts}</span>
                  <span className="text-subtle-foreground">/{max}</span>
                </span>
              </span>
              {detail?.note && <span className="mt-1 block pl-5 text-[13px] leading-5 text-muted-foreground">{detail.note}</span>}
            </button>
            {expanded && (
              <div className="px-4 pb-4 pl-9 sm:px-5 sm:pl-10">
                {detail?.math && <p className="font-mono text-[12px] text-subtle-foreground">{detail.math}</p>}
                {items.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {items.map(({ item, matched }) => (
                      <li key={`${matched}-${item}`} className="flex gap-2 text-[13px] leading-5">
                        {matched ? <Check className="mt-0.5 size-3.5 shrink-0 text-brand" strokeWidth={2.5} /> : <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" strokeWidth={2.5} />}
                        <span>
                          <span className={cn("font-medium", !matched && "text-muted-foreground")}>{item}</span>
                          {detail?.why?.[item] && <span className="text-muted-foreground">. {detail.why[item]}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[13px] text-muted-foreground">Nothing specific to match here.</p>
                )}
              </div>
            )}
          </li>
        );
      })}
      <li className="flex items-center justify-between px-4 py-3 text-[13px] sm:px-5">
        <span className="text-muted-foreground">Total</span>
        <span className="font-mono text-[12.5px] tabular-nums">
          {FIT_COMPONENTS.map(({ key }) => points[key] ?? 0).join(" + ")} = <span className="font-semibold">{FIT_COMPONENTS.reduce((sum, { key }) => sum + (points[key] ?? 0), 0)}</span>
        </span>
      </li>
    </ul>
  );
}
