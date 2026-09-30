import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ChevronRight, CircleCheck, OctagonX } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PasteJobBox } from "@/components/coach/paste-job-box";
import { CompanyAvatar } from "@/components/shared/fit";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { checkKnockouts, firstKnockout, knockoutCandidate } from "@/lib/fit/knockouts";
import { listMatches, requirementsOf } from "@/lib/jobs/store";
import { getProfile } from "@/lib/kb/profile";
import type { GateResult } from "@/lib/review/gate";
import { tidyLocation } from "@/lib/jobs/locations";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const [profile, matches] = await Promise.all([getProfile(userId), listMatches(userId, ["new", "saved"], 120)]);
  const resumes = matches.length
    ? await db.query.resume.findMany({
        where: and(eq(schema.resume.userId, userId), inArray(schema.resume.jobId, matches.map((m) => m.job.id))),
        orderBy: [desc(schema.resume.createdAt)],
        columns: { jobId: true, review: true },
      })
    : [];
  const candidate = knockoutCandidate(profile);
  const rows = matches
    .map(({ job, match }) => {
      const knockout = firstKnockout(checkKnockouts({ title: job.title, location: job.location, mode: job.mode, description: job.description, requirements: requirementsOf(job) }, candidate));
      const latest = resumes.find((r) => r.jobId === job.id);
      const review = latest?.review as unknown as GateResult | null | undefined;
      return { job, score: match.fitScore ?? 0, knockout, resume: latest ? (review?.passed ? "passed" : "built") : null };
    })
    // Roles you can take first, best fit first; knockouts at the bottom.
    .sort((a, b) => Number(Boolean(a.knockout)) - Number(Boolean(b.knockout)) || b.score - a.score);

  return (
    <PageBody className="max-w-4xl">
      <PageHeader title="Jobs" description="Paste any job you found. You'll see the knockouts first, then your fit score with the math shown, then one tailored resume." />
      <PasteJobBox className="mt-8" autoFocus={rows.length === 0} />

      <section className="mt-10" aria-labelledby="your-jobs">
        <h2 id="your-jobs" className="text-[15px] font-semibold tracking-tight">
          Your jobs <span className="font-normal text-subtle-foreground tabular-nums">{rows.length}</span>
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed p-5 text-[14px] text-muted-foreground">Nothing here yet. Paste a job above to get started.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-2xl border bg-background">
            {rows.map(({ job, score, knockout, resume }) => (
              <li key={job.id}>
                <Link href={`/app/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                  <CompanyAvatar name={job.company} className="hidden sm:grid" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{job.title}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{[job.company, tidyLocation(job.location)].filter(Boolean).join(" · ")}</span>
                    {knockout ? (
                      <span className="mt-1 flex items-start gap-1.5 text-[12.5px] text-destructive">
                        <OctagonX className="mt-0.5 size-3.5 shrink-0" />
                        <span className="line-clamp-2">Knockout: {knockout.reason}</span>
                      </span>
                    ) : resume ? (
                      <span className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                        <CircleCheck className={resume === "passed" ? "size-3.5 text-brand" : "size-3.5"} />
                        {resume === "passed" ? "Resume reviewed and ready to download" : "Resume built, review not passed yet"}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-[22px] leading-none font-semibold tabular-nums">{score}</span>
                    <span className="text-[11px] text-subtle-foreground">fit</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-subtle-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageBody>
  );
}
