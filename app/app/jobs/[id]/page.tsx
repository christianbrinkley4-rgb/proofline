import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, FileText, Lightbulb, Minus, TriangleAlert } from "lucide-react";
import { FitBreakdown } from "@/components/jobs/fit-breakdown";
import { JobActions } from "@/components/jobs/job-actions";
import { PageBody } from "@/components/app/page-header";
import { CompanyAvatar } from "@/components/shared/fit";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { FIT_BAND_LABEL, fitBand } from "@/lib/fit/rubric";
import { applicationGuide } from "@/lib/jobs/guide";
import { formatPay } from "@/lib/jobs/search";
import { fetchBoardDetail } from "@/lib/jobs/sources/boards";
import { workdayDetail } from "@/lib/jobs/sources/search-apis";
import { getJobForUser, requirementsOf, saveMatches, upsertJobs } from "@/lib/jobs/store";
import { getProfile } from "@/lib/kb/profile";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/app/jobs/[id]">): Promise<Metadata> {
  const session = await requireSession();
  const data = await getJobForUser(session.user.id, (await params).id);
  return { title: data ? `${data.job.title} at ${data.job.company}` : "Job" };
}

export default async function JobPage({ params }: PageProps<"/app/jobs/[id]">) {
  const session = await requireSession();
  const userId = session.user.id;
  const data = await getJobForUser(userId, (await params).id);
  if (!data) notFound();
  let { job } = data;

  // Listings from some boards arrive without the full posting; read it now so the score is complete.
  if (!job.description) {
    const detail = await (job.source === "workday" ? workdayDetail(job.sourceId) : fetchBoardDetail(job.source, job.sourceId)).catch(() => null);
    if (detail?.description) {
      const rows = await upsertJobs([
        {
          source: job.source,
          sourceId: job.sourceId,
          company: job.company,
          title: job.title,
          location: job.location,
          mode: detail.mode ?? job.mode,
          level: job.level,
          url: job.url,
          description: detail.description,
          department: detail.department ?? job.department,
          employmentType: detail.employmentType ?? job.employmentType,
          payMin: detail.payMin ?? job.payMin,
          payMax: detail.payMax ?? job.payMax,
          payPeriod: (detail.payPeriod ?? job.payPeriod) as "hour" | "year" | null,
          postedAt: job.postedAt,
        },
      ]);
      job = rows.values().next().value ?? job;
    }
  }

  // Always score against the profile as it is now: confirming a fact should move the number.
  const requirements = requirementsOf(job);
  const [candidate, profile] = await Promise.all([loadCandidate(userId), getProfile(userId)]);
  const fit = scoreFit({ title: job.title, location: job.location, mode: job.mode, level: job.level, requirements }, candidate);
  await saveMatches(userId, [{ job, fit }]);
  const band = fitBand(fit.score);
  const guide = applicationGuide(job, requirements, profile?.school);
  const pay = formatPay(job);

  return (
    <PageBody className="max-w-5xl">
      <Link href="/app/jobs" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        All jobs
      </Link>

      <header className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <CompanyAvatar name={job.company} className="size-12 text-[14px]" />
          <div className="min-w-0">
            <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em] sm:text-[28px]">{job.title}</h1>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              {[job.company, job.location, job.mode !== "unknown" ? job.mode[0].toUpperCase() + job.mode.slice(1) : null, pay].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-baseline gap-1 sm:flex-col sm:items-end">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[48px] leading-none font-semibold tracking-tight tabular-nums">{fit.score}</span>
            <span className="text-[14px] text-subtle-foreground">/100</span>
          </div>
          <span className="ml-3 flex items-center gap-1.5 text-[13px] font-medium sm:ml-0 sm:mt-1.5">
            <span className={cn("size-1.5 rounded-full", band === "strong" || band === "good" ? "bg-brand" : "bg-border-strong")} />
            {FIT_BAND_LABEL[band]}
          </span>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="lg" asChild>
          <a href={job.url} target="_blank" rel="noreferrer">
            Open the application
            <ArrowUpRight data-icon="inline-end" />
          </a>
        </Button>
        <Button size="lg" variant="outline" asChild disabled={Boolean(fit.cappedBy)}>
          <Link href={`/app/resumes/compare?job=${job.id}`}>
            <FileText data-icon="inline-start" />
            Compare tailored resumes
          </Link>
        </Button>
        <JobActions jobId={job.id} saved={data.match?.status === "saved"} />
      </div>

      {fit.cappedBy && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-pending/40 bg-pending-soft px-4 py-3 text-[13.5px] text-pending-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">Capped at {fit.score} from {fit.raw}.</span> {fit.cappedBy.reason} Probably not worth a tailored resume.
          </span>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="overflow-hidden rounded-xl border bg-background">
          <h2 className="border-b px-5 py-3 text-[14px] font-semibold">How the score adds up</h2>
          <FitBreakdown points={fit.points} details={fit.details} />
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border bg-background p-4">
            <h2 className="text-[12.5px] font-medium text-subtle-foreground">Your strengths for this role</h2>
            <ul className="mt-2 space-y-1.5">
              {fit.strengths.length === 0 && <li className="text-[13.5px] text-muted-foreground">Confirm more facts on your profile to see strengths here.</li>}
              {fit.strengths.map((s) => (
                <li key={s} className="flex gap-2 text-[13.5px]">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-brand" strokeWidth={2.5} />
                  {s}
                </li>
              ))}
            </ul>
            <h2 className="mt-4 text-[12.5px] font-medium text-subtle-foreground">Gaps</h2>
            <ul className="mt-2 space-y-1.5">
              {fit.gaps.length === 0 && <li className="text-[13.5px] text-muted-foreground">Nothing obvious.</li>}
              {fit.gaps.map((g) => (
                <li key={g} className="flex gap-2 text-[13.5px] text-muted-foreground">
                  <Minus className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
                  {g}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border bg-muted/40 p-4 text-[13px] leading-5 text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Lightbulb className="size-3.5" />
              Scored from confirmed facts only
            </div>
            <p className="mt-1">Confirm more of what you&apos;ve done on your profile and this score updates the next time you open it.</p>
          </section>
        </aside>
      </div>

      <section className="mt-8 rounded-xl border bg-background">
        <h2 className="border-b px-5 py-3 text-[14px] font-semibold">Exactly how to apply</h2>
        <ol className="divide-y">
          {guide.map((step, i) => (
            <li key={step.id} className="flex gap-4 px-5 py-4">
              <span className="font-mono text-[12px] text-subtle-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="text-[14px] font-medium">
                  {step.href ? (
                    <a href={step.href} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      {step.label}
                    </a>
                  ) : (
                    step.label
                  )}
                </div>
                <p className="mt-0.5 text-[13.5px] leading-6 text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {job.description && (
        <details className="group mt-8 rounded-xl border bg-background">
          <summary className="cursor-pointer list-none px-5 py-3 text-[14px] font-semibold">
            Full posting <span className="font-normal text-muted-foreground group-open:hidden">(show)</span>
          </summary>
          <div className="border-t px-5 py-4 text-[14px] leading-7 whitespace-pre-line text-muted-foreground">{job.description}</div>
        </details>
      )}
    </PageBody>
  );
}
