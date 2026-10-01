import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { FeedFilters } from "@/components/find/feed-filters";
import { FeedList } from "@/components/find/feed-list";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { scoringReady } from "@/lib/facts/base";
import { loadFeed } from "@/lib/jobs/feed/load";

export const metadata: Metadata = { title: "Find jobs" };

const PAGE = 30;
const MAX = 150;

function updatedLabel(at: Date | null, now: Date): string | null {
  if (!at) return null;
  const hours = Math.floor((now.getTime() - new Date(at).getTime()) / 36e5);
  if (hours < 1) return "Updated in the last hour";
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function FindJobsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await requireSession();
  const userId = session.user.id;
  const shown = Math.min(MAX, Math.max(PAGE, Number((await searchParams).show) || PAGE));
  const now = new Date();
  const [feed, readiness] = await Promise.all([loadFeed(userId, { limit: shown, now }), scoringReady(userId)]);
  const updated = updatedLabel(feed.updatedAt, now);

  return (
    <PageBody className="max-w-4xl">
      <PageHeader
        title="Find jobs"
        description={
          feed.poolSize
            ? `Internships and early-career jobs from ${feed.employers} employers, scored against your confirmed facts. Knockouts come first, and every score shows its math when you open the job.`
            : "Internships and entry-level jobs straight from employers, scored against what you've confirmed."
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/app/ready">Ready to apply</Link>
          </Button>
        }
      />

      {!readiness.ready && (
        <p className="mt-6 rounded-xl border border-pending/40 bg-pending-soft p-4 text-[14px] text-pending-ink">
          These scores only use facts you&apos;ve confirmed, and you haven&apos;t confirmed {readiness.hasEducation ? "a role" : "your education"} yet.{" "}
          <Link href="/app/facts" className="font-medium underline underline-offset-2">
            Add it in My facts
          </Link>{" "}
          for scores you can trust.
        </p>
      )}

      <div className="mt-8">
        <FeedFilters filters={feed.filters} />
      </div>

      <section className="mt-8" aria-labelledby="feed-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="feed-heading" className="text-[15px] font-semibold tracking-tight">
            {feed.total === 1 ? "1 job matches" : `${feed.total.toLocaleString()} jobs match`}
          </h2>
          <p className="text-[12.5px] text-subtle-foreground">
            {[feed.belowMinScore ? `${feed.belowMinScore} below your minimum fit are hidden` : null, updated].filter(Boolean).join(" · ")}
          </p>
        </div>

        {feed.poolSize === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed p-5 text-[14px] text-muted-foreground">
            No listings yet. The pool fills from employer boards once a day; check back after the next refresh, or{" "}
            <Link href="/app/jobs" className="font-medium text-foreground underline underline-offset-2">
              paste a job you found
            </Link>
            .
          </p>
        ) : feed.items.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed p-5 text-[14px] text-muted-foreground">
            <p>Nothing matches these filters. Try fewer keywords, include remote jobs, or lower the minimum fit.</p>
          </div>
        ) : (
          <>
            <p className="mt-1 mb-3 text-[12.5px] text-subtle-foreground">Best fit first. Jobs with a dealbreaker for you sit at the bottom, with the reason.</p>
            <FeedList items={feed.items} now={now.toISOString()} />
            {feed.total > feed.items.length && shown < MAX && (
              <div className="mt-4 flex justify-center">
                <Button asChild variant="outline" size="lg">
                  <Link href={`/app/find?show=${shown + PAGE}`} scroll={false}>
                    Show {Math.min(PAGE, feed.total - feed.items.length)} more
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </PageBody>
  );
}
