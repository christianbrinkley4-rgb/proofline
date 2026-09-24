import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, ArrowUpRight, Check, Minus, PenLine, TriangleAlert } from "lucide-react";
import { FitBreakdown } from "@/components/jobs/fit-breakdown";
import { GapCoach } from "@/components/jobs/gap-coach";
import { JobActions } from "@/components/jobs/job-actions";
import { ResumeTrio, type TrioResume } from "@/components/jobs/resume-trio";
import { PageBody } from "@/components/app/page-header";
import { CompanyAvatar } from "@/components/shared/fit";
import { Button } from "@/components/ui/button";
import { latestFactAt, storyReady } from "@/lib/agent/coach";
import { declinedSkills } from "@/lib/agent/gap-store";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { gapId, hardGaps, skillGaps } from "@/lib/fit/gaps";
import { FIT_BAND_LABEL, fitBand } from "@/lib/fit/rubric";
import { applicationGuide } from "@/lib/jobs/guide";
import { formatPay } from "@/lib/jobs/search";
import { fetchBoardDetail } from "@/lib/jobs/sources/boards";
import { workdayDetail } from "@/lib/jobs/sources/search-apis";
import { getJobForUser, requirementsOf, saveMatches, upsertJobs } from "@/lib/jobs/store";
import { listExperiences } from "@/lib/kb/experiences";
import { factCounts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { VARIANT_BLURB, VARIANT_LABEL, type VariantId } from "@/lib/resume/document";
import { screeningReport } from "@/lib/resume/screening";
import { listResumes } from "@/lib/resume/store";
import { STAGE_LABEL } from "@/lib/tracker/model";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/app/jobs/[id]">): Promise<Metadata> {
  const session = await requireSession();
  const data = await getJobForUser(session.user.id, (await params).id);
  return { title: data ? `${data.job.title} at ${data.job.company}` : "Job" };
}

const VARIANT_ORDER: VariantId[] = ["experience", "skills", "ats"];

export default async function JobPage({ params, searchParams }: PageProps<"/app/jobs/[id]">) {
  const session = await requireSession();
  const userId = session.user.id;
  const data = await getJobForUser(userId, (await params).id);
  if (!data) notFound();
  const autoBuild = (await searchParams).build === "1";
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
  const [candidate, profile, allResumes, application, facts, experiences, declined, factAt] = await Promise.all([
    loadCandidate(userId),
    getProfile(userId),
    listResumes(userId),
    db.query.application.findFirst({ where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, job.id)) }),
    factCounts(userId),
    listExperiences(userId),
    declinedSkills(userId),
    latestFactAt(userId),
  ]);
  const fit = scoreFit({ title: job.title, location: job.location, mode: job.mode, level: job.level, requirements }, candidate);
  await saveMatches(userId, [{ job, fit }]);
  const band = fitBand(fit.score);
  const guide = applicationGuide(job, requirements, profile?.school);
  const pay = formatPay(job);
  const publicFeedName = job.source === "himalayas" ? "Himalayas" : job.source === "jobicy" ? "Jobicy" : null;
  const applyUrl = /^https?:\/\//.test(job.url) ? job.url : null;

  // The newest version of each strategy, scored by how many requirements it visibly shows.
  const forJob = allResumes.filter((r) => r.row.jobId === job.id);
  const latest = VARIANT_ORDER.flatMap((v) => forJob.filter((r) => r.variant === v).slice(0, 1));
  const trio: TrioResume[] = latest.map((r) => {
    const report = screeningReport(r.document, requirements);
    return {
      id: r.row.id,
      label: VARIANT_LABEL[r.variant],
      blurb: VARIANT_BLURB[r.variant],
      version: r.row.version,
      covered: report.coveredRequired,
      total: report.totalRequired,
      checksOk: !r.checks.some((c) => c.blocking && c.status === "fail"),
      passed: r.checks.filter((c) => c.status === "pass").length,
      totalChecks: r.checks.length,
      fixFirst: r.checks.find((c) => c.status !== "pass")?.detail ?? null,
      top: r.why.slice(0, 2).map((w) => w.text),
    };
  });
  const best = [...trio].sort((a, b) => b.covered - a.covered || Number(b.checksOk) - Number(a.checksOk) || b.passed - a.passed)[0] ?? null;
  const newestBuilt = forJob[0]?.row.createdAt ?? null;
  const stale = Boolean(newestBuilt && factAt && factAt > newestBuilt);

  const gaps = skillGaps(fit, declined);
  const missingIds = new Set([...fit.details.requiredSkills.missing, ...fit.details.preferredSkills.missing, ...fit.details.keywords.missing].map(gapId));
  const declinedHere = [...fit.details.requiredSkills.missing, ...fit.details.preferredSkills.missing, ...fit.details.keywords.missing].filter(
    (s, i, all) => declined.has(gapId(s)) && all.findIndex((x) => gapId(x) === gapId(s)) === i,
  );
  const ready = storyReady({ confirmedFacts: facts.confirmed, experiences: experiences.length });
  const blocked = ready ? null : "Your resumes are built only from facts you've confirmed, and there aren't enough yet. Add one experience and come back: your fit and resumes will be waiting.";

  const status = !trio.length
    ? { step: 3, text: "Next: your three tailored resumes." }
    : gaps.length
      ? { step: 4, text: `Next: ${gaps.length} ${gaps.length === 1 ? "thing" : "things"} the posting asks for that your resume doesn't show yet.` }
      : stale
        ? { step: 4, text: "Next: rebuild your resumes with what you just added." }
        : { step: 5, text: "Your resume is as strong as your evidence allows. Download the best one." };

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
            <h1 className="font-display text-[26px] leading-tight font-semibold sm:text-[32px]">{job.title}</h1>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              {[job.company, job.location, job.mode !== "unknown" ? job.mode[0].toUpperCase() + job.mode.slice(1) : null, pay].filter(Boolean).join(" · ")}
            </p>
            <p className={cn("mt-3 inline-flex items-center gap-2 text-[13px] font-medium", status.step > 4 ? "text-brand-ink" : "text-foreground")}>
              <span className={cn("size-1.5 rounded-full", status.step > 4 ? "bg-brand" : "bg-ink")} />
              {status.text}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-baseline gap-1 sm:flex-col sm:items-end">
          <div className="flex items-baseline gap-0.5">
            <span className="font-display text-[52px] leading-none font-semibold tabular-nums">{fit.score}</span>
            <span className="text-[14px] text-subtle-foreground">/100</span>
          </div>
          <span className="ml-3 flex items-center gap-1.5 text-[13px] font-medium sm:mt-1.5 sm:ml-0">
            <span className={cn("size-1.5 rounded-full", band === "strong" || band === "good" ? "bg-brand" : "bg-border-strong")} />
            {FIT_BAND_LABEL[band]}
          </span>
          <span className="ml-3 max-w-44 text-[11.5px] leading-4 text-muted-foreground sm:mt-1 sm:ml-0 sm:text-right">Profile fit, not your chance of being hired</span>
        </div>
      </header>

      {fit.cappedBy && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-pending/40 bg-pending-soft px-4 py-3 text-[13.5px] text-pending-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">Capped at {fit.score} from {fit.raw}.</span> {fit.cappedBy.reason} Check this requirement before you apply.
          </span>
        </div>
      )}

      <section aria-labelledby="fit-heading" className="mt-8 grid gap-4 md:grid-cols-2">
        <h2 id="fit-heading" className="sr-only">
          Your fit
        </h2>
        <div className="rounded-2xl border bg-background p-5">
          <h3 className="text-[13px] font-medium text-subtle-foreground">Where you&apos;re strong</h3>
          <ul className="mt-2 space-y-1.5">
            {fit.strengths.length === 0 && <li className="text-[13.5px] text-muted-foreground">Confirm more of what you&apos;ve done to see strengths here.</li>}
            {fit.strengths.map((s) => (
              <li key={s} className="flex gap-2 text-[14px]">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand" strokeWidth={2.5} />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-background p-5">
          <h3 className="text-[13px] font-medium text-subtle-foreground">What they ask for that you haven&apos;t shown</h3>
          <ul className="mt-2 space-y-1.5">
            {fit.gaps.length === 0 && <li className="text-[13.5px] text-muted-foreground">Nothing obvious.</li>}
            {fit.gaps.map((g) => (
              <li key={g} className="flex gap-2 text-[14px] text-muted-foreground">
                <Minus className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
                {g}
              </li>
            ))}
          </ul>
        </div>
        <details className="group rounded-2xl border bg-background md:col-span-2">
          <summary className="cursor-pointer list-none px-5 py-3 text-[14px] font-medium">
            How the score adds up <span className="font-normal text-muted-foreground group-open:hidden">(show)</span>
          </summary>
          <div className="border-t">
            <FitBreakdown points={fit.points} details={fit.details} />
          </div>
        </details>
      </section>

      <section id="resumes" aria-labelledby="resumes-heading" className="mt-10 scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="resumes-heading" className="font-display text-[24px] font-semibold">
            Your three resumes
          </h2>
          {best && best.total > 0 && (
            <p className="text-[13px] text-muted-foreground">
              Best pick: <span className="font-medium text-foreground">{best.label}</span>, showing {best.covered} of {best.total} requirements.
            </p>
          )}
        </div>
        <ResumeTrio jobId={job.id} resumes={trio} bestId={best?.id ?? null} stale={stale} autoBuild={autoBuild && ready} blocked={blocked} />
      </section>

      <section id="strengthen" aria-labelledby="strengthen-heading" className="mt-10 scroll-mt-20">
        <h2 id="strengthen-heading" className="font-display text-[24px] font-semibold">
          Make it stronger
        </h2>
        <p className="mt-1 mb-4 max-w-2xl text-[14px] leading-6 text-muted-foreground">
          {gaps.length
            ? "The fastest way to a better resume is real evidence for what they ask. Tell me where you've done each one, in your own words. I'll write the bullet and rescore your fit. Nothing gets added that you didn't say."
            : "Nothing left to ask about for this posting."}
        </p>
        <GapCoach
          jobId={job.id}
          gaps={gaps}
          declined={declinedHere.filter((s) => missingIds.has(gapId(s)))}
          experiences={experiences.filter((e) => e.kind !== "education").map((e) => ({ id: e.id, org: e.org, title: e.title }))}
          advice={hardGaps(fit)}
        />
      </section>

      <section aria-labelledby="next-heading" className="mt-12 rounded-2xl border bg-muted/30 p-5 sm:p-6">
        <h2 id="next-heading" className="text-[15px] font-semibold">When your resume is ready</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          {application ? `In your tracker as ${STAGE_LABEL[application.stage]}.` : "Write the cover letter from the same facts, then apply on their site and track it."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="lg" variant="outline" asChild className="bg-background">
            <Link href={`/app/jobs/${job.id}/packet`}>
              <PenLine data-icon="inline-start" />
              Cover letter and interview prep
            </Link>
          </Button>
          {applyUrl && (
            <Button size="lg" variant="ghost" asChild>
              <a href={applyUrl} target="_blank" rel="noreferrer">
                {publicFeedName ? `View on ${publicFeedName}` : "Open the posting"}
                <ArrowUpRight data-icon="inline-end" />
              </a>
            </Button>
          )}
          <JobActions jobId={job.id} saved={data.match?.status === "saved"} tracked={Boolean(application)} />
        </div>
      </section>

      <details className="group mt-6 rounded-2xl border bg-background">
        <summary className="cursor-pointer list-none px-5 py-3 text-[14px] font-medium">
          Exactly how to apply <span className="font-normal text-muted-foreground group-open:hidden">(show)</span>
        </summary>
        <ol className="divide-y border-t">
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
      </details>

      {job.description && (
        <details className="group mt-3 rounded-2xl border bg-background">
          <summary className="cursor-pointer list-none px-5 py-3 text-[14px] font-medium">
            Full posting <span className="font-normal text-muted-foreground group-open:hidden">(show)</span>
          </summary>
          <div className="border-t px-5 py-4 text-[14px] leading-7 whitespace-pre-line text-muted-foreground">{job.description}</div>
        </details>
      )}
      {publicFeedName && (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Job data from{" "}
          <a className="underline underline-offset-2 hover:text-foreground" href={job.url} target="_blank" rel="noreferrer">
            {publicFeedName}
          </a>
          . Check the original listing for application details.
        </p>
      )}
    </PageBody>
  );
}
