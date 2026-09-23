import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { factCounts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";

function greeting(name: string) {
  const first = name.split(/\s+/)[0];
  const hour = new Date().getHours();
  const part = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  return `${part}, ${first}.`;
}

export default async function TodayPage() {
  const session = await requireSession();
  const profile = await getProfile(session.user.id);
  const facts = await factCounts(session.user.id);
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
