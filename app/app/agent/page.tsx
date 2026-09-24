import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, Bot, CalendarClock, CircleCheck, FileText, MessagesSquare, Search, Sparkles, UserRound } from "lucide-react";
import { AgentChat } from "@/components/agent/agent-chat";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/auth";
import { listChat } from "@/lib/agent/chat-store";
import { nextMoves, type NextMove } from "@/lib/agent/next-moves";
import { factCounts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { anthropicClient } from "@/lib/llm/provider";
import { listApplications } from "@/lib/tracker/service";

export const metadata: Metadata = { title: "Agent" };

const ICON: Record<NextMove["kind"], typeof UserRound> = {
  confirm_facts: UserRound,
  answer_questions: UserRound,
  follow_up: CalendarClock,
  deadline: CalendarClock,
  resume: FileText,
  prep: MessagesSquare,
  explore: Search,
  news: BellRing,
  prefs: Sparkles,
};

export default async function AgentPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const [profile, facts, applications, moves, chat] = await Promise.all([
    getProfile(userId),
    factCounts(userId),
    listApplications(userId),
    nextMoves(userId),
    listChat(userId),
  ]);

  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        title="Your agent"
        description="Ask for help with any part of your search. It works from your confirmed story; you choose what to apply for and what to send."
      />
      <section className="mt-6 grid grid-cols-3 gap-3">
        <Summary value={facts.confirmed} label="Confirmed facts" href="/app/profile" />
        <Summary value={profile?.targetRoles.length ?? 0} label="Target roles" href="/app/onboarding?step=goals" />
        <Summary value={applications.length} label="Tracked" href="/app/tracker" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(17rem,1fr)]">
        <AgentChat initial={chat} mode={anthropicClient() ? "model" : "offline"} />
        <aside className="space-y-4">
          <section className="rounded-xl border bg-background p-4 sm:p-5">
            <h2 className="text-[14px] font-semibold tracking-tight">What needs your attention</h2>
            {moves.length ? (
              <div className="mt-3 space-y-2">
                {moves.slice(0, 6).map((move, index) => {
                  const Icon = ICON[move.kind];
                  return (
                    <Link key={move.href + String(index)} href={move.href} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60">
                      <Icon className={`mt-0.5 size-4 shrink-0 ${move.kind === "follow_up" || move.kind === "deadline" ? "text-pending-ink" : "text-brand"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium">{move.title}</span>
                        <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">{move.detail}</span>
                      </span>
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed p-4">
                <CircleCheck className="size-5 text-brand" />
                <p className="mt-2 text-[13px] font-medium">You are caught up.</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Add another experience or run a search to keep things moving.</p>
              </div>
            )}
          </section>
          <section className="rounded-xl border bg-background p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-brand" />
              <h2 className="text-[14px] font-semibold tracking-tight">Use your own AI</h2>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">
              Prefer Claude or Cursor? Connect it and it gets the same tools and the same rules as this agent.
            </p>
            <Link href="/app/settings#ai" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium hover:underline">
              Set up a connection <ArrowRight className="size-3.5" />
            </Link>
          </section>
          <p className="px-1 text-[11.5px] leading-5 text-subtle-foreground">
            Proofline never applies or sends email for you. It drafts, and records what you tell it you sent.
          </p>
        </aside>
      </div>
    </PageBody>
  );
}

function Summary({ value, label, href }: { value: number; label: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-background p-3.5 transition-colors hover:border-border-strong sm:p-4">
      <span className="text-[12px] text-subtle-foreground">{label}</span>
      <span className="mt-0.5 block text-[22px] font-semibold tracking-tight tabular-nums sm:text-[26px]">{value}</span>
    </Link>
  );
}
