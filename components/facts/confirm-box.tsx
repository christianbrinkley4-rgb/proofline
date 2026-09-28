"use client";

import { cn } from "@/lib/utils";

/** The explicit "this is true" every new or edited fact needs. Nothing is saved without it. */
export function ConfirmBox({ checked, onChange, className, children }: { checked: boolean; onChange: (checked: boolean) => void; className?: string; children?: React.ReactNode }) {
  return (
    <label className={cn("flex min-h-10 cursor-pointer items-start gap-2.5 text-[13px] leading-5", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]" />
      <span>{children ?? "This is true, and it's in my own words."}</span>
    </label>
  );
}
