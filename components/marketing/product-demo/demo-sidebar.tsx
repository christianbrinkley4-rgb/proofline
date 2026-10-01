import { ClipboardPaste, FileText, ListChecks, SquareKanban } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { site } from "@/lib/site";
import { DEMO_CANDIDATE } from "@/lib/demo/sample-data";
import { cn } from "@/lib/utils";
import type { DemoTab } from "./index";

const NAV = [
  { label: "Jobs", icon: ClipboardPaste, tabs: ["find", "score"] },
  { label: "Resumes", icon: FileText, tabs: ["tailor"] },
  { label: "Tracker", icon: SquareKanban, tabs: ["track"] },
  { label: "My experience", icon: ListChecks, tabs: [] },
] as const satisfies ReadonlyArray<{ label: string; icon: unknown; tabs: readonly DemoTab[] }>;

const SAVED_ROLES = [
  { name: "Whitfield & Lowe, Audit", fresh: 0 },
  { name: "Keystone Mutual, Finance", fresh: 1 },
  { name: "Pellham Software, Revenue", fresh: 0 },
];

export function DemoSidebar({ tab, facts }: { tab: DemoTab; facts: { confirmed: number; toReview: number } }) {
  const { confirmed, toReview } = facts;
  const total = confirmed + toReview;

  return (
    <aside aria-hidden="true" className="hidden w-56 shrink-0 flex-col border-r bg-muted/50 md:flex">
      <div className="flex h-12 items-center gap-2 px-4">
        <LogoMark className="size-5" />
        <span className="text-[13px] font-semibold tracking-tight">{site.name}</span>
      </div>

      <nav className="px-2 pt-1">
        {NAV.map(({ label, icon: Icon, tabs }) => {
          const active = (tabs as readonly DemoTab[]).includes(tab);
          return (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]",
                active ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {label}
            </div>
          );
        })}
      </nav>

      <div className="mt-6 px-4 text-[11px] font-medium tracking-wide text-subtle-foreground">Saved roles</div>
      <ul className="mt-1.5 space-y-0.5 px-2">
        {SAVED_ROLES.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] text-muted-foreground">
            <span className="truncate">{s.name}</span>
            {s.fresh > 0 && (
              <span className="rounded-full bg-background px-1.5 text-[11px] font-medium text-foreground tabular-nums ring-1 ring-border">
                {s.fresh}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">JR</span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{DEMO_CANDIDATE.name}</div>
            <div className="truncate text-[11.5px] text-muted-foreground">Accounting, NC State &apos;28</div>
          </div>
        </div>
        <div className="mt-3 flex h-1 overflow-hidden rounded-full bg-muted">
          <span className="bg-brand" style={{ width: `${(confirmed / total) * 100}%` }} />
          <span className="bg-pending transition-[width] duration-500" style={{ width: `${(toReview / total) * 100}%` }} />
        </div>
        <div className="mt-2 text-[11.5px] text-muted-foreground">
          {confirmed} things confirmed
          {toReview > 0 ? <span className="text-pending-ink"> · {toReview} to review</span> : " · all reviewed"}
        </div>
      </div>
    </aside>
  );
}
