import Link from "next/link";
import { ArrowRight, ListChecks, SquareKanban } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PasteJobBox } from "@/components/coach/paste-job-box";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { scoringReady } from "@/lib/facts/base";
import { listRuns } from "@/lib/agent/runs";
import { listMatches } from "@/lib/jobs/store";
import { factCounts } from "@/lib/kb/facts";
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
  const [profile, facts, applications, matches, readiness, runs] = await Promise.all([
    getProfile(userId),
    factCounts(userId),
    listApplications(userId),
    listMatches(userId, ["new", "saved"], 5),
    scoringReady(userId),
    listRuns(userId),
  ]);
  const readyCount = runs.filter((r) => r.status === "ready").length;
  const stats = trackerStats(applications);
  const onboarded = Boolean(profile?.onboardingCompletedAt);

  return (
    <PageBody className="max-w-4xl">
      <PageHeader title={greeting(profile?.fullName || session.user.name)} description="Paste a job you want. I'll show how well you fit, then make a one-page resume for it from what you've told me." />

      {!onboarded || !readiness.ready ? (
        <section className="mt-8 rounded-2xl border bg-background p-5 shadow-lift sm:p-6">
          <p className="text-[12px] font-medium text-brand-ink">Start here</p>
          <h2 className="mt-1 font-display text-[22px] font-semibold">{profile?.onboardingStep ? "Pick up where you left off" : "Your first resume in a few minutes"}</h2>
          <p className="mt-1 max-w-xl text-[14px] leading-6 text-muted-foreground">
            Tell me your school and one thing you&apos;ve done, like a job, club, or class project. I&apos;ll draft the resume lines, you keep the true ones, and only those go on a resume.
          </p>
          <Button size="lg" className="mt-4" asChild>
            <Link href="/app/onboarding">
              {profile?.onboardingStep ? "Continue setup" : "Get started"}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </section>
      ) : (
        <>
          <PasteJobBox className="mt-8" />
          <p className="mt-3 text-[13px] text-muted-foreground">
            No job in mind?{" "}
            <Link href="/app/find" className="inline-flex min-h-6 items-center font-medium text-foreground underline-offset-2 hover:underline">
              See internships and entry-level jobs that fit you
            </Link>
          </p>
        </>
      )}

      {readyCount > 0 && (
        <Link href="/app/ready" className="mt-8 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-[14px] text-brand-ink hover:bg-brand-soft/70">
          <span className="min-w-0 flex-1 font-medium">
            {readyCount === 1 ? "1 job is ready to apply" : `${readyCount} jobs are ready to apply`}
            <span className="block text-[12.5px] font-normal">Each resume passed review against your facts.</span>
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      )}

      {matches.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight">Your latest jobs</h2>
            <Link href="/app/jobs" className="inline-flex min-h-6 items-center text-[12.5px] text-muted-foreground hover:text-foreground">
              See all
            </Link>
          </div>
          <ul className="mt-3 divide-y rounded-xl border bg-background">
            {matches.slice(0, 5).map(({ job, match }) => (
              <li key={job.id}>
                <Link href={`/app/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{job.title}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{[job.company, job.location].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">{match.fitScore ?? "–"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link href="/app/facts" className="rounded-xl border bg-background p-4 transition-colors hover:bg-muted/40">
          <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <ListChecks className="size-4" />
            My experience
          </span>
          <span className="mt-1 block font-display text-[26px] font-semibold tabular-nums">{facts.confirmed}</span>
          <span className="text-[12.5px] text-muted-foreground">lines and details you confirmed</span>
        </Link>
        <Link href="/app/tracker" className="rounded-xl border bg-background p-4 transition-colors hover:bg-muted/40">
          <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <SquareKanban className="size-4" />
            Applications
          </span>
          <span className="mt-1 block font-display text-[26px] font-semibold tabular-nums">{stats.applications}</span>
          <span className={stats.dueFollowUps ? "text-[12.5px] font-medium text-pending-ink" : "text-[12.5px] text-muted-foreground"}>
            {stats.dueFollowUps ? `${stats.dueFollowUps} follow-up${stats.dueFollowUps === 1 ? "" : "s"} due` : "applications tracked"}
          </span>
        </Link>
      </section>
    </PageBody>
  );
}
