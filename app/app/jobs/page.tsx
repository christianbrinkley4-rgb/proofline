import { Suspense } from "react";
import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { db, schema } from "@/lib/db";
import { JobSearch } from "@/components/jobs/job-search";
import { requireSession } from "@/lib/auth";
import { fitBand } from "@/lib/fit/rubric";
import { formatPay, type JobResult } from "@/lib/jobs/search";
import { listMatches } from "@/lib/jobs/store";
import { getProfile } from "@/lib/kb/profile";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: PageProps<"/app/jobs">) {
  const session = await requireSession();
  const { q } = await searchParams;
  const profile = await getProfile(session.user.id);
  const [matches, lastSearch] = await Promise.all([
    listMatches(session.user.id, ["new", "saved"], 120),
    db.query.agentEvent.findFirst({
      where: and(eq(schema.agentEvent.userId, session.user.id), eq(schema.agentEvent.type, "search_run")),
      orderBy: [desc(schema.agentEvent.createdAt)],
    }),
  ]);
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
        <Suspense>
          <JobSearch initialQuery={query || defaultQuery} initialResults={initialResults} autoRun={Boolean(query)} />
        </Suspense>
      </div>
    </PageBody>
  );
}
