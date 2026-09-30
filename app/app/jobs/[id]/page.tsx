import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Lightbulb, Lock, Minus, Sparkles } from "lucide-react";
import { PageBody } from "@/components/app/page-header";
import { GapQuestions, type GapQuestion } from "@/components/jobs/gap-questions";
import { JobActions } from "@/components/jobs/job-actions";
import { JobDetailsEditor } from "@/components/jobs/job-details-editor";
import { KnockoutPanel } from "@/components/jobs/knockout-panel";
import { ScoreBreakdown } from "@/components/jobs/score-breakdown";
import { TailorPanel, type TailorResumeView } from "@/components/jobs/tailor-panel";
import { CompanyAvatar } from "@/components/shared/fit";
import { Button } from "@/components/ui/button";
import { logEvent } from "@/lib/agent/events";
import { declinedSkills } from "@/lib/agent/gap-store";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { fieldOf, scoringReady } from "@/lib/facts/base";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { gapId, skillGaps } from "@/lib/fit/gaps";
import { extractSkills } from "@/lib/fit/skills";
import { crossPostingInsight, roleRewards } from "@/lib/fit/insights";
import { checkKnockouts, firstKnockout, knockoutCandidate } from "@/lib/fit/knockouts";
import { FIT_BAND_LABEL, fitBand } from "@/lib/fit/rubric";
import { formatPay } from "@/lib/jobs/search";
import { normalizePhrase } from "@/lib/jobs/keywords";
import { getJobForUser, keywordsOf, requirementsOf, saveMatches } from "@/lib/jobs/store";
import { listExperiences } from "@/lib/kb/experiences";
import { listFacts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { activeShare } from "@/lib/proof/share";
import { layoutResume } from "@/lib/resume/layout";
import { getResume } from "@/lib/resume/store";
import { gateStatus } from "@/lib/review/gate";
import { reviewConfigured } from "@/lib/review/model";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/app/jobs/[id]">): Promise<Metadata> {
  const session = await requireSession();
  const data = await getJobForUser(session.user.id, (await params).id);
  return { title: data ? `${data.job.title} at ${data.job.company}` : "Job" };
}

export default async function JobPage({ params, searchParams }: PageProps<"/app/jobs/[id]">) {
  const session = await requireSession();
  const userId = session.user.id;
  const data = await getJobForUser(userId, (await params).id);
  if (!data) notFound();
  const { job } = data;
  const tab = (await searchParams).tab === "tailor" ? "tailor" : "score";

  const requirements = requirementsOf(job);
  const keywords = keywordsOf(job);
  const [candidate, profile, experiences, declined, readiness, application, latestResumeRow, cross, latestFact, latestRejection] = await Promise.all([
    loadCandidate(userId),
    getProfile(userId),
    listExperiences(userId),
    declinedSkills(userId),
    scoringReady(userId),
    db.query.application.findFirst({ where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, job.id)) }),
    db.query.resume.findFirst({ where: and(eq(schema.resume.userId, userId), eq(schema.resume.jobId, job.id)), orderBy: [desc(schema.resume.createdAt)], columns: { id: true } }),
    crossPostingInsight(userId),
    db.query.fact.findFirst({ where: eq(schema.fact.userId, userId), orderBy: [desc(schema.fact.createdAt)], columns: { createdAt: true } }),
    db.query.agentEvent.findFirst({ where: and(eq(schema.agentEvent.userId, userId), eq(schema.agentEvent.type, "fact_rejected")), orderBy: [desc(schema.agentEvent.createdAt)], columns: { createdAt: true } }),
  ]);

  // Knockouts first, on their own. The score never includes them.
  const knockouts = checkKnockouts({ title: job.title, location: job.location, mode: job.mode, description: job.description, requirements }, knockoutCandidate(profile));
  const knockout = firstKnockout(knockouts);
  const fit = scoreFit({ title: job.title, location: job.location, mode: job.mode, level: job.level, requirements, keywords }, candidate);
  await saveMatches(userId, [{ job, fit }]);
  if (tab === "score") await logEvent(userId, "score_viewed", { jobId: job.id, score: fit.score, knockout: knockout?.key ?? null });
  const band = fitBand(fit.score);
  const rewards = roleRewards(job.description, requirements, keywords);
  const pay = formatPay(job);
  const applyUrl = /^https?:\/\//.test(job.url) ? job.url : null;
  const modeLabel = job.mode !== "unknown" ? job.mode[0].toUpperCase() + job.mode.slice(1) : null;

  const tailorBlocked = knockout
    ? `Knockout: ${knockout.reason} Tailoring is off for jobs you can't take.`
    : !readiness.ready
      ? "Add your education and one experience on My facts first. Your resume is built only from confirmed facts."
      : null;

  // The Tailor tab: the one resume, its review, and the questions that could make it stronger.
  let resume: TailorResumeView | null = null;
  if (tab === "tailor" && latestResumeRow) {
    const stored = await getResume(userId, latestResumeRow.id);
    if (stored) {
      const layout = await layoutResume(stored.document, stored.template);
      const [gate, confirmed, share] = await Promise.all([gateStatus(userId, stored, layout), listFacts(userId, { states: ["confirmed"] }), activeShare(userId, stored.row.id)]);
      // A bullet that stands on exactly one of the person's own bullet facts can be edited right on the page.
      const bulletFacts = new Map(confirmed.filter((f) => fieldOf(f) === "bullet").map((f) => [f.id, f.content]));
      const changedAt = [latestFact?.createdAt, latestRejection?.createdAt].filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0];
      resume = {
        resumeId: stored.row.id,
        version: stored.row.version,
        ops: layout.ops,
        family: stored.template.family,
        why: stored.why,
        cuts: stored.cuts,
        adjustments: stored.adjustments,
        linter: gate.linter,
        model: gate.review?.model ?? null,
        reviewedAt: gate.review?.at ?? null,
        stale: gate.stale,
        canExport: gate.canExport,
        reason: gate.reason,
        lines: gate.lines.map((l) => ({ text: l.text, bulletId: l.bulletId, factIds: l.factIds, factText: l.factIds?.length === 1 ? bulletFacts.get(l.factIds[0]) : undefined })),
        outdated: Boolean(changedAt && changedAt > stored.row.createdAt),
        aiConfigured: reviewConfigured(),
        shareSlug: share?.slug ?? null,
      };
    }
  }
  // One question per thing: "Journal entries" (required) and "journal entry" (keyword) are the same ask.
  // Keyword-only gaps must be real skills, not the job title or a place.
  const asked = new Set<string>();
  const gaps: GapQuestion[] = skillGaps(fit, declined, 8)
    .filter((g) => g.kind !== "keyword" || extractSkills(g.skill).length > 0)
    .filter((g) => {
      const keys = [normalizePhrase(g.skill), ...extractSkills(g.skill).map(normalizePhrase)];
      if (keys.some((k) => asked.has(k))) return false;
      keys.forEach((k) => asked.add(k));
      return true;
    })
    .slice(0, 6)
    .map((g) => ({ id: g.id, skill: g.skill, kind: g.kind }));
  const missingIds = new Set([...fit.details.requiredSkills.missing, ...fit.details.preferredSkills.missing, ...fit.details.keywords.missing].map(gapId));
  const declinedHere = [...fit.details.requiredSkills.missing, ...fit.details.preferredSkills.missing].filter((s, i, all) => declined.has(gapId(s)) && missingIds.has(gapId(s)) && all.indexOf(s) === i);
  const places = experiences.filter((e) => e.kind !== "education").map((e) => ({ id: e.id, name: [e.title, e.org].filter(Boolean).join(", ") }));

  return (
    <PageBody className="max-w-6xl">
      <Link href="/app/jobs" className="inline-flex min-h-6 items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        All jobs
      </Link>

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <CompanyAvatar name={job.company} className="size-12 text-[14px]" />
          <div className="min-w-0">
            <h1 className="font-display text-[24px] leading-tight font-semibold sm:text-[30px]">{job.title}</h1>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              {[job.company, job.location, modeLabel && !job.location?.toLowerCase().includes(job.mode) ? modeLabel : null, pay].filter(Boolean).join(" · ")}
            </p>
            {job.sourceId.startsWith("pasted:") && (
              <JobDetailsEditor key={`${job.title}|${job.company}|${job.location ?? ""}`} jobId={job.id} title={job.title} company={job.company} location={job.location ?? ""} />
            )}
            {job.closedAt && (
              <p className="mt-2 text-[13px] text-pending-ink">
                {job.company} took this posting down around {job.closedAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, so it has probably stopped taking applications.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {applyUrl && (
            <Button size="lg" variant="ghost" asChild>
              <a href={applyUrl} target="_blank" rel="noreferrer">
                Open the posting
                <ArrowUpRight data-icon="inline-end" />
              </a>
            </Button>
          )}
          <JobActions jobId={job.id} saved={data.match?.status === "saved"} tracked={Boolean(application)} />
        </div>
      </header>

      <div className="mt-6">
        <KnockoutPanel knockouts={knockouts} jobId={job.id} />
      </div>

      <nav aria-label="Job sections" className="mt-6 flex gap-1 border-b">
        <TabLink href={`/app/jobs/${job.id}`} active={tab === "score"}>
          Fit score
        </TabLink>
        <TabLink href={`/app/jobs/${job.id}?tab=tailor`} active={tab === "tailor"} locked={Boolean(tailorBlocked)}>
          Tailor
        </TabLink>
      </nav>

      {tab === "score" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section aria-labelledby="score-heading" className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="score-heading" className="text-[13px] font-medium text-subtle-foreground">
                  Fit score
                </h2>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-[52px] leading-none font-semibold tabular-nums">
                    <span className="sr-only">{fit.score}</span>
                    <span aria-hidden="true" className="count-up" style={{ "--to": fit.score } as React.CSSProperties} />
                  </span>
                  <span className="text-[14px] text-subtle-foreground">/100</span>
                  <span className="ml-3 flex items-center gap-1.5 text-[13px] font-medium">
                    <span className={cn("size-1.5 rounded-full", band === "strong" || band === "good" ? "bg-brand" : "bg-border-strong")} />
                    {FIT_BAND_LABEL[band]}
                  </span>
                </div>
              </div>
              <p className="max-w-56 text-[12px] leading-4 text-muted-foreground sm:text-right">How your confirmed facts line up with this posting. Not your chance of being hired.</p>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border bg-background">
              <ScoreBreakdown points={fit.points} details={fit.details} />
            </div>
          </section>

          <aside aria-label="Strengths and gaps" className="space-y-4">
            <Notes title="Strengths" icon="check" items={fit.strengths} empty="Confirm more of what you've done to see strengths here." />
            <Notes title="Gaps" icon="minus" items={fit.gaps} empty="Nothing obvious." />
            <Notes title="What this role rewards" icon="spark" items={rewards} />
            <div className="rounded-2xl border bg-muted/40 p-4">
              <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Lightbulb className="size-4" />
                Across your saved roles
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-6 text-muted-foreground">{cross.text}</p>
            </div>
            {tailorBlocked ? (
              <p className="flex items-start gap-2 rounded-xl border p-3 text-[13px] leading-5 text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" />
                {tailorBlocked}
              </p>
            ) : (
              <Button size="xl" className="w-full" asChild>
                <Link href={`/app/jobs/${job.id}?tab=tailor`}>
                  Tailor my resume for this job
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            )}
          </aside>
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          <TailorPanel jobId={job.id} resume={resume} blocked={tailorBlocked} autoBuild={!latestResumeRow} />
          {!tailorBlocked && (
            <section aria-labelledby="gaps-heading">
              <h2 id="gaps-heading" className="font-display text-[22px] font-semibold">
                Make it stronger
              </h2>
              <p className="mt-1 mb-4 max-w-2xl text-[14px] leading-6 text-muted-foreground">
                Things this posting asks for that your facts don&apos;t show yet. Answer only with what&apos;s true; nothing is added until you confirm it.
              </p>
              <GapQuestions jobId={job.id} gaps={gaps} declined={declinedHere} places={places} />
            </section>
          )}
        </div>
      )}

      {job.description && (
        <details className="group mt-10 rounded-2xl border bg-background">
          <summary className="cursor-pointer list-none px-5 py-3 text-[14px] font-medium">
            Full posting <span className="font-normal text-muted-foreground group-open:hidden">(show)</span>
          </summary>
          <div className="border-t px-5 py-4 text-[14px] leading-7 whitespace-pre-line text-muted-foreground">{job.description}</div>
        </details>
      )}
    </PageBody>
  );
}

function TabLink({ href, active, locked, children }: { href: string; active: boolean; locked?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-[14px] transition-colors",
        active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {locked && <Lock className="size-3.5" />}
      {children}
    </Link>
  );
}

function Notes({ title, items, empty, icon }: { title: string; items: string[]; empty?: string; icon: "check" | "minus" | "spark" }) {
  const Icon = icon === "check" ? Check : icon === "minus" ? Minus : Sparkles;
  return (
    <div className="rounded-2xl border bg-background p-4">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.length === 0 && empty && <li className="text-[13.5px] text-muted-foreground">{empty}</li>}
        {items.map((s) => (
          <li key={s} className="flex gap-2 text-[13.5px] leading-5">
            <Icon className={cn("mt-0.5 size-3.5 shrink-0", icon === "check" ? "text-brand" : "text-muted-foreground")} strokeWidth={2.5} />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
