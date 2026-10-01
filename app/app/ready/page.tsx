import type { Metadata } from "next";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { DismissMenu } from "@/components/ready/dismiss-menu";
import { ReasonForm } from "@/components/ready/reason-form";
import { RuleList } from "@/components/ready/rule-list";
import { RunLoopButton } from "@/components/ready/run-loop-button";
import { CompanyAvatar } from "@/components/shared/fit";
import { Button } from "@/components/ui/button";
import { listRules } from "@/lib/agent/rules";
import { listRuns, type RunItem } from "@/lib/agent/runs";
import { requireSession } from "@/lib/auth";
import { scoringReady } from "@/lib/facts/base";

export const metadata: Metadata = { title: "Ready to apply" };
// A run confirms postings live and reviews up to three resumes.
export const maxDuration = 120;

const STEP_LABEL: Record<string, string> = { found: "Matched", live: "Still open", fit: "Fit check", track: "Tracker", resume: "Resume", review: "Resume review", letter: "Cover letter" };

/** A role is waiting on the one sentence only the person can write. */
const needsReason = (run: RunItem) => run.steps.some((s) => s.step === "letter" && !s.ok && s.needs === "why");

function Trail({ steps }: { steps: RunItem["steps"] }) {
  return (
    <ol className="mt-3 space-y-1 text-[13px]">
      {steps.map((s) => (
        <li key={s.step} className="flex items-start gap-2">
          {s.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-brand-ink" aria-label="Passed" /> : <X className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-label="Stopped here" />}
          <span className="min-w-0 text-muted-foreground">
            <span className="font-medium text-foreground">{STEP_LABEL[s.step] ?? s.step}.</span> {s.note}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Role({ run, children }: { run: RunItem; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
      <CompanyAvatar name={run.company} className="mt-0.5 hidden sm:grid" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/app/jobs/${run.jobId}`} className="text-[15px] leading-5 font-medium hover:underline hover:underline-offset-2">
              {run.title}
            </Link>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{[run.company, run.location].filter(Boolean).join(" · ")}</p>
          </div>
          {run.fit !== null && (
            <span className="shrink-0 text-right">
              <span className="block font-display text-[24px] leading-none font-semibold tabular-nums">{run.fit}</span>
              <span className="text-[11px] text-subtle-foreground">fit</span>
            </span>
          )}
        </div>
        {children}
        <details className="mt-3">
          <summary className="inline-flex min-h-6 cursor-pointer items-center text-[13px] text-muted-foreground hover:text-foreground">What was checked</summary>
          <Trail steps={run.steps} />
        </details>
      </div>
    </li>
  );
}

export default async function ReadyPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const [runs, rules, readiness] = await Promise.all([listRuns(userId), listRules(userId), scoringReady(userId)]);
  const ready = runs.filter((r) => r.status === "ready");
  const needsYou = runs.filter((r) => r.status === "needs_you");
  const skipped = runs.filter((r) => r.status === "skipped");
  const unconfirmed = runs.filter((r) => r.status === "unconfirmed");

  return (
    <PageBody className="max-w-4xl">
      <PageHeader
        title="Ready to apply"
        description="Proofline takes the best-fitting open jobs, confirms each posting is still live, builds the resume and the cover letter from your confirmed facts, and reviews both. The one thing it asks you for is why you want each job, in your own words. You read everything and apply yourself."
      />

      <div className="mt-6">
        <RunLoopButton disabled={!readiness.ready} />
        {!readiness.ready && (
          <p className="mt-3 text-[14px] text-muted-foreground">
            Add your {readiness.hasEducation ? "first role" : "school"} in{" "}
            <Link href="/app/facts" className="font-medium text-foreground underline underline-offset-2">
              My experience
            </Link>{" "}
            first. Resumes are made only from what you have confirmed.
          </p>
        )}
        <p className="mt-3 max-w-2xl text-[13px] text-subtle-foreground">
          Postings on Greenhouse, Lever, Ashby, and SmartRecruiters can be confirmed open this way. Jobs from other sources stay in Find jobs, where you can open them yourself.
        </p>
      </div>

      <section className="mt-10" aria-labelledby="ready-heading">
        <h2 id="ready-heading" className="text-[15px] font-semibold tracking-tight">
          {ready.length === 1 ? "1 ready" : `${ready.length} ready`}
        </h2>
        {ready.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed p-5 text-[14px] text-muted-foreground">
            Nothing ready yet. Run it above and the roles where the resume and the cover letter both pass review will wait here, already saved to Applications.
          </p>
        ) : (
          <ul className="mt-3 divide-y rounded-2xl border bg-background">
            {ready.map((run) => (
              <Role key={run.id} run={run}>
                <p className="mt-2 text-[13px] text-muted-foreground">The resume and the cover letter both passed review against your facts and this posting. Read them, then fill in the application.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button asChild size="sm">
                    <Link href={`/app/jobs/${run.jobId}?tab=resume`}>Read the resume</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/jobs/${run.jobId}/packet#letter`}>Read the cover letter</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/jobs/${run.jobId}/kit`}>Application answers</Link>
                  </Button>
                  <DismissMenu runId={run.id} company={run.company} />
                </div>
              </Role>
            ))}
          </ul>
        )}
      </section>

      {needsYou.length > 0 && (
        <section className="mt-10" aria-labelledby="needs-heading">
          <h2 id="needs-heading" className="text-[15px] font-semibold tracking-tight">
            {needsYou.length === 1 ? "1 needs you" : `${needsYou.length} need you`}
          </h2>
          <ul className="mt-3 divide-y rounded-2xl border bg-background">
            {needsYou.map((run) => (
              <Role key={run.id} run={run}>
                <p className="mt-2 rounded-lg border border-pending/40 bg-pending-soft px-3 py-2 text-[13px] text-pending-ink">{run.reason}</p>
                {needsReason(run) && <ReasonForm runId={run.id} company={run.company} />}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/jobs/${run.jobId}?tab=resume`}>Open the resume</Link>
                  </Button>
                  {run.steps.some((s) => s.step === "letter") && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/app/jobs/${run.jobId}/packet#letter`}>Open the cover letter</Link>
                    </Button>
                  )}
                  <DismissMenu runId={run.id} company={run.company} />
                </div>
              </Role>
            ))}
          </ul>
        </section>
      )}

      {unconfirmed.length > 0 && (
        <p className="mt-8 text-[13px] text-muted-foreground">
          {unconfirmed.length === 1 ? "1 job couldn't be confirmed open" : `${unconfirmed.length} jobs couldn't be confirmed open`} because the employer&apos;s board didn&apos;t answer. They&apos;ll be checked again on the next run.
        </p>
      )}

      {skipped.length > 0 && (
        <section className="mt-10" aria-labelledby="skipped-heading">
          <h2 id="skipped-heading" className="text-[15px] font-semibold tracking-tight">
            Skipped, with the reason
          </h2>
          <ul className="mt-3 divide-y rounded-2xl border bg-background">
            {skipped.slice(0, 20).map((run) => (
              <li key={run.id} className="px-4 py-3 text-[13.5px]">
                <span className="font-medium">{run.title}</span> <span className="text-muted-foreground">at {run.company}.</span> <span className="text-muted-foreground">{run.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 border-t pt-8" aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="text-[15px] font-semibold tracking-tight">
          Standing rules
        </h2>
        <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
          When you tell Proofline a job isn&apos;t for you, you can make it permanent. Find jobs and every run follow these, and you can remove any of them.
        </p>
        {rules.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-subtle-foreground">None yet. Use Not for me on a result to add one.</p>
        ) : (
          <RuleList rules={rules} />
        )}
      </section>
    </PageBody>
  );
}
