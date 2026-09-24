import Link from "next/link";
import { ArrowRight, BellRing, CalendarClock, FileText, MessagesSquare, NotebookPen, PenLine, Search, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import type { NextMove } from "@/lib/agent/next-moves";
import { cn } from "@/lib/utils";

export const MOVE_ICON: Record<NextMove["kind"], LucideIcon> = {
  add_story: NotebookPen,
  confirm_facts: UserRound,
  answer_questions: UserRound,
  follow_up: CalendarClock,
  deadline: CalendarClock,
  resume: FileText,
  packet: PenLine,
  prep: MessagesSquare,
  explore: Search,
  news: BellRing,
  prefs: Sparkles,
};

/** Secondary moves: compact rows, one line of why each. The coach card owns the primary action. */
export function MoveList({ moves, empty }: { moves: NextMove[]; empty?: React.ReactNode }) {
  if (!moves.length) return empty ? <>{empty}</> : null;
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-background">
      {moves.map((move, i) => {
        const Icon = MOVE_ICON[move.kind];
        const urgent = move.kind === "follow_up" || move.kind === "deadline";
        return (
          <li key={move.href + String(i)}>
            <Link href={move.href} className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
              <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", urgent ? "bg-pending-soft text-pending-ink" : "bg-brand-soft text-brand-ink")}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{move.title}</span>
                <span className="block text-[12.5px] leading-5 text-muted-foreground">{move.detail}</span>
              </span>
              <ArrowRight className="mt-1.5 size-3.5 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
