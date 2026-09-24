import Link from "next/link";
import { ArrowRight, CalendarClock, FileText, Search, SquareKanban } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { factCounts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { listApplications } from "@/lib/tracker/service";
import { trackerStats } from "@/lib/tracker/model";
import { listResumes } from "@/lib/resume/store";

function greeting(name: string) {
  const first = name.split(/\s+/)[0];
  const hour = new Date().getHours();
  const part = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  return `${part}, ${first}.`;
}

export default async function TodayPage() {
  const session = await requireSession();
  const [profile, facts, applications, resumes] = await Promise.all([
    getProfile(session.user.id), factCounts(session.user.id), listApplications(session.user.id), listResumes(session.user.id),
  ]);
  const stats = trackerStats(applications);
  const due = applications.filter((app) => app.stage === "applied" && app.nextFollowUpAt && app.nextFollowUpAt <= new Date());
  const onboarded = Boolean(profile?.onboardingCompletedAt);

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

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Confirmed facts" value={facts.confirmed} href="/app/profile" />
        <Stat label="Waiting on you" value={facts.toReview} href="/app/profile" tone={facts.toReview ? "pending" : undefined} />
        <Stat label="Target roles" value={profile?.targetRoles.length ?? 0} href="/app/onboarding" />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-xl border bg-background p-5 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="text-[17px] font-semibold tracking-tight">Your next moves</h2><Link href="/app/tracker" className="text-[12px] text-muted-foreground hover:text-foreground">Open tracker</Link></div>
          <div className="mt-4 space-y-2">
            {due.slice(0, 3).map((app) => <Link key={app.id} href="/app/tracker" className="flex items-start gap-3 rounded-lg border border-pending/30 bg-pending-soft p-3"><CalendarClock className="mt-0.5 size-4 shrink-0 text-pending-ink" /><span className="text-[13px]"><span className="font-medium">Follow up with {app.company}</span><span className="block text-muted-foreground">{app.title}. Your draft is ready in the tracker.</span></span></Link>)}
            {facts.toReview > 0 && <Link href="/app/profile" className="flex items-start gap-3 rounded-lg border p-3 text-[13px]"><FileText className="mt-0.5 size-4 shrink-0 text-pending" /><span>Review {facts.toReview} facts or questions. Each answer can sharpen your matches and resumes.</span></Link>}
            {applications.length === 0 && <Link href="/app/jobs" className="flex items-start gap-3 rounded-lg border p-3 text-[13px]"><Search className="mt-0.5 size-4 shrink-0" /><span>Explore matching roles. Save one to begin tracking your search.</span></Link>}
            {applications.length > 0 && due.length === 0 && facts.toReview === 0 && <p className="rounded-lg border border-dashed p-4 text-[13px] text-muted-foreground">No reminders due. Keep your story current so the next role gets a better match.</p>}
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
          <Link href="/app/tracker" className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium hover:underline"><SquareKanban className="size-4" />See every application <ArrowRight className="size-3.5" /></Link>
        </div>
      </section>
    </PageBody>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "pending" }) {
  return (
    <Link href={href} className="rounded-xl border bg-background p-4 transition-colors hover:border-border-strong">
      <div className="text-[12.5px] text-subtle-foreground">{label}</div>
      <div className={`mt-1 text-[26px] font-semibold tracking-tight tabular-nums ${tone === "pending" ? "text-pending-ink" : ""}`}>
        {value}
      </div>
    </Link>
  );
}
