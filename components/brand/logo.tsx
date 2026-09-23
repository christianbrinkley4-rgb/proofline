import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Three lines of a resume; the last one carries the green "confirmed" dot. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
      <rect width="24" height="24" rx="6" className="fill-foreground" />
      <path
        d="M6.5 7.75h11M6.5 12h8M6.5 16.25h4"
        className="stroke-background"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16.25" cy="16.25" r="2.25" className="fill-brand" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">{site.name}</span>
    </span>
  );
}
