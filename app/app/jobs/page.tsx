import { Suspense } from "react";
import type { Metadata } from "next";
import { after } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { db, schema } from "@/lib/db";
import { AgentSuggestions } from "@/components/jobs/agent-suggestions";
import { JobSearch } from "@/components/jobs/job-search";
import { WatchedSearches } from "@/components/jobs/watched-searches";
import { requireSession } from "@/lib/auth";
import { preferenceSuggestions } from "@/lib/agent/preferences";
import { fitBand } from "@/lib/fit/rubric";
import { formatPay, type JobResult } from "@/lib/jobs/search";
import { listWatched, markViewed } from "@/lib/jobs/saved";
import { listMatches } from "@/lib/jobs/store";
import { getProfile } from "@/lib/kb/profile";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: PageProps<"/app/jobs">) {
  const session = await requireSession();
  const { q } = await searchParams;
  const profile = await getProfile(session.user.id);
  const [matches, recentSearches, watched] = await Promise.all([
    listMatches(session.user.id, ["new", "saved"], 120),
    db.query.agentEvent.findMany({
      where: and(eq(schema.agentEvent.userId, session.user.id), eq(schema.agentEvent.type, "search_run")),
      orderBy: [desc(schema.agentEvent.createdAt)],
      limit: 20,
    }),
    listWatched(session.user.id),
  ]);
  const suggestions = await preferenceSuggestions(session.user.id);
  // Background refreshes of watched searches don't count as "your latest search".
  const lastSearch = recentSearches.find((e) => !e.data.savedSearchId);
  // Opening a watched search (from Today or a chip) means its new postings have been seen.
  const opened = typeof q === "string" ? watched.find((w) => w.newJobIds.length && w.query.trim().toLowerCase() === q.trim().toLowerCase()) : undefined;
  if (opened) after(() => markViewed(session.user.id, opened.id).catch(() => {}));
  // Saved jobs always show; unsaved ones only from the most recent search, so old results don't pile up.
  const since = lastSearch ? lastSearch.createdAt.getTime() - 10 * 60 * 1000 : 0;
  const current = matches.filter(({ match }) => match.status === "saved" || match.updatedAt.getTime() >= since);

  const initialResults: JobResult[] = current.map(({ job, match }) => {
    const fit = (match.fit ?? {}) as { cappedBy?: { reason?: string } | null };
    return {
      jobId: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      mode: job.mode,
      level: job.level,
      pay: formatPay(job),
      postedAt: job.postedAt?.toISOString() ?? null,
      source: job.source,
      url: job.url,
      score: match.fitScore ?? 0,
      band: fitBand(match.fitScore ?? 0),
      cappedBy: fit.cappedBy?.reason ?? null,
      status: match.status,
      termMatch: false,
      alsoIn: [],
    };
  });

  const defaultQuery = [
    profile?.targetRoles[0] ?? "",
    profile?.targetLocations.find((l) => !/remote/i.test(l)) ? `in ${profile.targetLocations.find((l) => !/remote/i.test(l))}` : "",
    profile?.targetTerm ? `for ${profile.targetTerm}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const query = typeof q === "string" ? q : "";

  return (
    <PageBody>
      <PageHeader
        title="Jobs"
        description="Tell your agent what you want. It searches employer career sites and job boards live, merges duplicates, and scores every opening against your confirmed profile."
      />
      <div className="mt-8">
        <AgentSuggestions suggestions={suggestions.map((s) => ({ key: s.key, question: s.question, because: s.because }))} />
        <WatchedSearches searches={watched.map((w) => ({ id: w.id, query: w.query, fresh: w.newJobIds.length, lastRunAt: w.lastRunAt?.toISOString() ?? null }))} />
        <Suspense>
          {/* Keyed by the query so opening a watched search starts it fresh. */}
          <JobSearch key={query} initialQuery={query || defaultQuery} initialResults={initialResults} autoRun={Boolean(query)} />
        </Suspense>
      </div>
    </PageBody>
  );
}
