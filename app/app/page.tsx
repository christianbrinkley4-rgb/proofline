import Link from "next/link";
import { after } from "next/server";
import { ArrowRight, BellRing, SquareKanban } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { JourneyRail } from "@/components/coach/journey-rail";
import { MoveList } from "@/components/coach/move-list";
import { RoleExplorer } from "@/components/jobs/role-explorer";
import { requireSession } from "@/lib/auth";
import { loadJourney } from "@/lib/agent/coach";
import { nextMoves } from "@/lib/agent/next-moves";
import { refreshDue, watchedWithNews } from "@/lib/jobs/saved";
import { recommendRoles } from "@/lib/jobs/recommend";
import { listExperiences } from "@/lib/kb/experiences";
import { listFacts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { trackerStats } from "@/lib/tracker/model";
import { listApplications } from "@/lib/tracker/service";

function greeting(name: string) {
  const first = name.split(/\s+/)[0];
  const hour = new Date().getHours();
  const part = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  return `${part}, ${first}.`;
}

export default async function TodayPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const [profile, profileFacts, experiences, applications, moves, watched, journey] = await Promise.all([
    getProfile(userId),
    listFacts(userId),
    listExperiences(userId),
    listApplications(userId),
    nextMoves(userId),
    watchedWithNews(userId),
    loadJourney(userId),
  ]);
  // Watched searches that haven't run in a while refresh after this page is sent, so the next visit has news.
  after(() => refreshDue({ userId, limit: 2 }).catch(() => 0));

  const stats = trackerStats(applications);
  const onboarded = Boolean(profile?.onboardingCompletedAt);
  const news = watched.filter((w) => w.fresh.length);
  const confirmed = profileFacts.filter((fact) => fact.verificationState === "confirmed");
  const toReview = profileFacts.length - confirmed.length;
  const roleIdeas = recommendRoles({ targetRoles: profile?.targetRoles ?? [], confirmedFacts: confirmed, experiences });

  // Before onboarding, the story step is setup itself.
  const action =
    !onboarded && journey.current === "story"
      ? {
          title: profile?.onboardingStep ? "Pick up where you left off" : "Let your agent get to know you",
          detail: "Upload a resume or answer a few questions. Everything you say becomes a fact you confirm, and only those facts reach a resume.",
          href: "/app/onboarding",
          cta: profile?.onboardingStep ? "Continue setup" : "Start setup",
        }
      : undefined;

  // The coach card owns the primary action; list the rest without repeating it.
  const primaryHref = (action ?? journey.action).href;
  const others = moves.filter((m) => m.kind !== "news" && m.href !== primaryHref).slice(0, 4);

  return (
    <PageBody>
      <PageHeader
        title={greeting(profile?.fullName || session.user.name)}
        description={journey.current === "done" ? "Nice work. That application is out. Here's what's next." : "One step at a time. Here's the next one."}
      />

      <div className="mt-8">
        <JourneyRail journey={journey} action={action} />
      </div>

      {news.length > 0 && (
        <section className="mt-8 rounded-2xl border border-brand/30 bg-background p-5 sm:p-6">
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

      {onboarded && (journey.current === "find" || journey.current === "fit") && <RoleExplorer roles={roleIdeas} />}

      {onboarded && (
        <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold tracking-tight">Also on your list</h2>
              <Link href="/app/agent" className="text-[12px] text-muted-foreground hover:text-foreground">
                Ask your agent
              </Link>
            </div>
            <div className="mt-3">
              <MoveList
                moves={others}
                empty={<p className="rounded-xl border border-dashed p-4 text-[13px] text-muted-foreground">Nothing else due. Focus on the step above.</p>}
              />
            </div>
          </div>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Your search so far</h2>
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border">
              <Stat label="Confirmed facts" value={confirmed.length} href="/app/profile" />
              <Stat label="Waiting on you" value={toReview} href="/app/profile" tone={toReview ? "pending" : undefined} />
              <Stat label="Applications sent" value={stats.applications} href="/app/tracker" />
              <Stat label="Follow-ups due" value={stats.dueFollowUps} href="/app/tracker" tone={stats.dueFollowUps ? "pending" : undefined} />
            </dl>
            <Link href="/app/tracker" className="mt-3 inline-flex items-center gap-2 text-[13px] font-medium hover:underline">
              <SquareKanban className="size-4" />
              See every application <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>
      )}
    </PageBody>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "pending" }) {
  return (
    <Link href={href} className="bg-background p-4 transition-colors hover:bg-muted/40">
      <dt className="text-[12px] text-subtle-foreground">{label}</dt>
      <dd className={`mt-0.5 font-display text-[26px] font-semibold tabular-nums ${tone === "pending" ? "text-pending-ink" : ""}`}>{value}</dd>
    </Link>
  );
}
