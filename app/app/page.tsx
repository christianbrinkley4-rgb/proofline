import Link from "next/link";
import { after } from "next/server";
import { ArrowRight, BellRing, CalendarClock, FileText, MessagesSquare, Search, SquareKanban, UserRound } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { nextMoves, type NextMove } from "@/lib/agent/next-moves";
import { refreshDue, watchedWithNews } from "@/lib/jobs/saved";
import { factCounts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { listResumes } from "@/lib/resume/store";
import { trackerStats } from "@/lib/tracker/model";
import { listApplications } from "@/lib/tracker/service";

function greeting(name: string) {
  const first = name.split(/\s+/)[0];
  const hour = new Date().getHours();
  const part = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  return `${part}, ${first}.`;
}

const ICON: Record<NextMove["kind"], typeof UserRound> = {
  verify: UserRound,
  follow_up: CalendarClock,
  deadline: CalendarClock,
  resume: FileText,
  prep: MessagesSquare,
  explore: Search,
  news: BellRing,
};

export default async function TodayPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const [profile, facts, applications, resumes, moves, watched] = await Promise.all([
    getProfile(userId),
    factCounts(userId),
    listApplications(userId),
    listResumes(userId),
    nextMoves(userId),
    watchedWithNews(userId),
  ]);
  // Watched searches that haven't run in a while refresh after this page is sent, so the next visit has news.
  after(() => refreshDue({ userId, limit: 2 }).catch(() => 0));

  const stats = trackerStats(applications);
  const onboarded = Boolean(profile?.onboardingCompletedAt);
  const news = watched.filter((w) => w.fresh.length);

  return (
    <PageBody>
      <PageHeader
        title={greeting(profile?.fullName || session.user.name)}
        description={
          onboarded
            ? "Here's what your agent found and what it needs from you."
            : "Your agent needs to know you before it can hunt for you. It takes a few minutes."
        }
      />

      {!onboarded && (
        <section className="mt-8 overflow-hidden rounded-xl border bg-background">
          <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div>
              <p className="font-mono text-[12px] text-subtle-foreground">Step 1 of 1</p>
              <h2 className="mt-2 text-[20px] font-semibold tracking-tight">Set up your agent</h2>
              <p className="mt-1.5 max-w-xl text-[14.5px] leading-6 text-muted-foreground">
                Upload a resume or answer a few questions. Your agent turns what you say into facts you confirm, then uses
                only those to find jobs and write your resumes.
              </p>
            </div>
            <Button size="xl" asChild>
              <Link href="/app/onboarding">
                {profile?.onboardingStep ? "Pick up where you left off" : "Start"}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {news.length > 0 && (
        <section className="mt-8 rounded-xl border border-brand/30 bg-background p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <BellRing className="size-4 text-brand" />
            <h2 className="text-[17px] font-semibold tracking-tight">New since you last looked</h2>
          </div>
          <div className="mt-4 space-y-5">
            {news.map((w) => (
              <div key={w.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] text-muted-foreground">
                    <span className="font-medium text-foreground tabular-nums">{w.fresh.length} new</span> for &ldquo;{w.query}&rdquo;
                  </p>
                  <Link href={`/app/jobs?q=${encodeURIComponent(w.query)}`} className="shrink-0 text-[12px] text-muted-foreground hover:text-foreground">
                    See all
                  </Link>
                </div>
                <ul className="mt-2 divide-y rounded-lg border">
                  {w.fresh.slice(0, 3).map((j) => (
                    <li key={j.jobId}>
                      <Link href={`/app/jobs/${j.jobId}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium">{j.title}</span>
                          <span className="block truncate text-[12px] text-muted-foreground">{[j.company, j.location].filter(Boolean).join(" · ")}</span>
                        </span>
                        {j.fit != null && <span className="text-[13px] font-semibold tabular-nums">{j.fit}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Confirmed facts" value={facts.confirmed} href="/app/profile" />
        <Stat label="Waiting on you" value={facts.toReview} href="/app/profile" tone={facts.toReview ? "pending" : undefined} />
        <Stat label="Watched searches" value={watched.length} href="/app/jobs" />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-xl border bg-background p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold tracking-tight">Your next moves</h2>
            <Link href="/app/agent" className="text-[12px] text-muted-foreground hover:text-foreground">
              Ask your agent
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {moves.filter((m) => m.kind !== "news").slice(0, 5).map((move, i) => {
              const Icon = ICON[move.kind];
              const urgent = move.kind === "follow_up" || move.kind === "deadline";
              return (
                <Link
                  key={move.href + String(i)}
                  href={move.href}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-[13px] transition-colors hover:bg-muted/50 ${urgent ? "border-pending/30 bg-pending-soft" : ""}`}
                >
                  <Icon className={`mt-0.5 size-4 shrink-0 ${urgent ? "text-pending-ink" : "text-brand"}`} />
                  <span>
                    <span className="font-medium">{move.title}</span>
                    <span className="block text-muted-foreground">{move.detail}</span>
                  </span>
                </Link>
              );
            })}
            {moves.length === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-[13px] text-muted-foreground">
                No reminders due. Keep your story current so the next role gets a better match.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-background p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold tracking-tight">Search in motion</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Applications sent" value={stats.applications} href="/app/tracker" />
            <Stat label="Interviews" value={stats.interviews} href="/app/tracker" />
            <Stat label="Resume versions" value={resumes.length} href="/app/resumes" />
            <Stat label="Follow-ups due" value={stats.dueFollowUps} href="/app/tracker" tone={stats.dueFollowUps ? "pending" : undefined} />
          </div>
          <Link href="/app/tracker" className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium hover:underline">
            <SquareKanban className="size-4" />
            See every application <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>
    </PageBody>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "pending" }) {
  return (
    <Link href={href} className="rounded-xl border bg-background p-4 transition-colors hover:border-border-strong">
      <div className="text-[12.5px] text-subtle-foreground">{label}</div>
      <div className={`mt-1 text-[26px] font-semibold tracking-tight tabular-nums ${tone === "pending" ? "text-pending-ink" : ""}`}>{value}</div>
    </Link>
  );
}
