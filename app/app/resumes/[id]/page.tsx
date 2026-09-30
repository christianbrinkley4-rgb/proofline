import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PRIVATE_BETA } from "@/lib/beta";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageBody } from "@/components/app/page-header";
import { PasteJobBox } from "@/components/coach/paste-job-box";
import { FeedbackControl } from "@/components/feedback/feedback-control";
import { ResumeWorkspace } from "@/components/resume/resume-workspace";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { jobDocumentImprovementSteps } from "@/lib/jobs/coaching";
import { requirementsOf } from "@/lib/jobs/store";
import { listExperiences } from "@/lib/kb/experiences";
import { listBullets } from "@/lib/resume/bullets/service";
import { documentBullets, type TemplateId } from "@/lib/resume/document";
import { exportBlocked } from "@/lib/resume/quality";
import { freshChecks, getResume } from "@/lib/resume/store";

export const metadata: Metadata = { title: "Resume" };

export default async function ResumePage({ params }: PageProps<"/app/resumes/[id]">) {
  const session = await requireSession();
  const stored = await getResume(session.user.id, (await params).id);
  if (!stored) notFound();
  // In the private beta a resume lives on its job's Tailor tab, with the review gate.
  if (PRIVATE_BETA) redirect(stored.row.jobId ? `/app/jobs/${stored.row.jobId}?tab=tailor` : "/app/jobs");
  const { layout, checks } = await freshChecks(session.user.id, stored);
  const job = stored.row.jobId ? await db.query.job.findFirst({ where: (j, { eq }) => eq(j.id, stored.row.jobId!) }) : null;
  // Roles with confirmed facts but no resume lines are silently left off; say so and say how to fix it.
  const [experiences, bullets] = job
    ? [[], []]
    : await Promise.all([listExperiences(session.user.id), listBullets(session.user.id)] as const);
  const leftOff = experiences.filter((e) => e.kind !== "education" && !bullets.some((b) => b.experienceId === e.id && b.status === "active"));
  const coaching = job ? jobDocumentImprovementSteps({
    jobId: job.id,
    fit: scoreFit({ title: job.title, location: job.location, mode: job.mode, level: job.level, requirements: requirementsOf(job) }, await loadCandidate(session.user.id)),
    resumeBullets: documentBullets(stored.document).map((bullet) => bullet.text),
  }) : [];

  return (
    <PageBody className="max-w-7xl">
      <Link href={job ? `/app/jobs/${job.id}` : "/app/resumes"} className="inline-flex min-h-6 items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        {job ? "Back to the job" : "All resumes"}
      </Link>
      <div className="mt-3">
        <p className="text-[12.5px] text-subtle-foreground">
          {job ? "Tailored resume" : "General resume"} · version {stored.row.version}
        </p>
        <h1 className="mt-0.5 text-[24px] leading-tight font-semibold tracking-[-0.02em] sm:text-[28px]">
          {job ? (
            <>
              {job.title} <span className="font-normal text-muted-foreground">at {job.company}</span>
            </>
          ) : (
            "Your general resume"
          )}
        </h1>
      </div>
      {coaching.length > 0 && (
        <section className="mt-5 rounded-xl border bg-background p-4">
          <h2 className="text-[14px] font-semibold">Make this resume stronger for the job</h2>
          <ul className="mt-2 space-y-2 text-[13px] leading-5">
            {coaching.slice(0, 2).map((step) => (
              <li key={step.id}><Link href={step.href} className="font-medium underline-offset-2 hover:underline">{step.title}</Link>. <span className="text-muted-foreground">{step.detail}</span></li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-5">
        <ResumeWorkspace
          resumeId={stored.row.id}
          jobId={stored.row.jobId}
          ops={layout.ops}
          family={stored.template.family}
          why={stored.why}
          cuts={stored.cuts}
          checks={checks}
          adjustments={stored.adjustments}
          variant={stored.variant}
          template={stored.template.id as TemplateId}
          blocked={exportBlocked(checks)}
        />
      </div>
      {!job && leftOff.length > 0 && (
        <section className="mt-6 max-w-2xl rounded-xl border border-pending/40 bg-pending-soft/50 p-4 text-[13.5px] leading-6">
          <h2 className="font-semibold">Not on this resume yet</h2>
          <p className="mt-1 text-muted-foreground">
            {leftOff.map((e) => e.org).join(", ")} {leftOff.length === 1 ? "has" : "have"} no resume lines yet, so {leftOff.length === 1 ? "it stays" : "they stay"} off
            the page. Press Write bullets on your profile, then rebuild.
          </p>
          <Link href="/app/profile" className="mt-2 inline-flex min-h-10 items-center gap-1 font-medium underline-offset-4 hover:underline">
            Go to your profile <ArrowRight className="size-3.5" />
          </Link>
        </section>
      )}
      {!job && (
        <section aria-labelledby="after-general" className="mt-6 max-w-2xl rounded-2xl border bg-background p-5">
          <p className="text-[12px] font-medium text-brand-ink">Next step</p>
          <h2 id="after-general" className="mt-1 font-display text-[20px] font-semibold">Paste a job you want</h2>
          <p className="mt-1 text-[13.5px] leading-6 text-muted-foreground">
            I&apos;ll score your fit and build one tailored version of this resume for it, using only your confirmed facts.
          </p>
          <PasteJobBox className="mt-4" compact />
        </section>
      )}
      <FeedbackControl kind="resume" subjectId={stored.row.id} className="mt-6 max-w-2xl" />
    </PageBody>
  );
}
