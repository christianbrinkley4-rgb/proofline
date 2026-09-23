import { Check, Minus } from "lucide-react";
import { fitBand } from "@/lib/fit/rubric";
import { cn } from "@/lib/utils";

export function CompanyAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg border bg-muted text-[12px] font-semibold tracking-tight text-muted-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Compact score readout: number over a thin bar. Accent only for scores worth applying to. */
export function ScoreMeter({ score, className }: { score: number; className?: string }) {
  const band = fitBand(score);
  const worthIt = band === "strong" || band === "good";
  return (
    <span className={cn("flex w-11 shrink-0 flex-col items-end gap-1", className)}>
      <span className={cn("text-[15px] leading-none font-semibold tabular-nums", !worthIt && "text-muted-foreground")}>
        {score}
      </span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full origin-left rounded-full motion-safe:animate-bar-grow", worthIt ? "bg-brand" : "bg-border-strong")}
          style={{ width: `${score}%` }}
        />
      </span>
    </span>
  );
}

export function MatchChip({ children, matched }: { children: React.ReactNode; matched: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[12px] leading-5",
        matched ? "bg-background text-foreground" : "border-dashed border-border-strong text-muted-foreground",
      )}
    >
      {matched ? (
        <Check className="size-3 text-brand" strokeWidth={2.5} aria-label="Matched" />
      ) : (
        <Minus className="size-3" strokeWidth={2.5} aria-label="Missing" />
      )}
      {children}
    </span>
  );
}

export function FactChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] leading-5 text-muted-foreground">
      <Check className="size-3 text-brand" strokeWidth={2.5} aria-hidden="true" />
      {children}
    </span>
  );
}
