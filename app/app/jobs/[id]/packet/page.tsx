import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StepSection } from "@/components/coach/step-section";
import { FeedbackControl } from "@/components/feedback/feedback-control";
import { ApplicationAnswers } from "@/components/packet/application-answers";
import { CoverLetterEditor, type SourceView } from "@/components/packet/cover-letter-editor";
import { InterviewPrep } from "@/components/packet/interview-prep";
import { Button } from "@/components/ui/button";
import { packetStep } from "@/lib/agent/coach";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { jobDocumentImprovementSteps } from "@/lib/jobs/coaching";
import { getJobForUser, requirementsOf } from "@/lib/jobs/store";
import { getProfile } from "@/lib/kb/profile";
import { hasUsableJobDescription } from "@/lib/jobs/description";
import { letterStatus } from "@/lib/packet/cover-letter";
import { packetView } from "@/lib/packet/service";
import { VARIANT_LABEL } from "@/lib/resume/document";
import { STAGE_LABEL } from "@/lib/tracker/model";

export async function generateMetadata({ params }: PageProps<"/app/jobs/[id]/packet">): Promise<Metadata> {
  const session = await requireSession();
  const data = await getJobForUser(session.user.id, (await params).id);
  return { title: data ? `Packet for ${data.job.company}` : "Application packet" };
}

const ORDER = ["resume", "letter", "track"] as const;

export default async function PacketPage({ params }: PageProps<"/app/jobs/[id]/packet">) {
  const session = await requireSession();
  const userId = session.user.id;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getJobForUser(userId, id);
  if (!data) notFound();
  const { job } = data;
  const [view, profile, application, resumes] = await Promise.all([
    packetView(userId, id),
    getProfile(userId),
    db.query.application.findFirst({ where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, id)) }),
    db.query.resume.findMany({
      where: and(eq(schema.resume.userId, userId), eq(schema.resume.jobId, id)),
      orderBy: [desc(schema.resume.createdAt)],
      columns: { id: true, variant: true, version: true, createdAt: true },
    }),
  ]);
  if (!view) notFound();
  const attached = application?.resumeId ? resumes.find((r) => r.id === application.resumeId) : undefined;
  const sources: Record<string, SourceView> = Object.fromEntries(view.evidence.map((e) => [e.id, { id: e.id, text: e.text, org: e.org }]));
  const name = profile?.fullName || session.user.name;
  const canDraft = hasUsableJobDescription(job.description);
  const letterCoaching = view.letter ? jobDocumentImprovementSteps({
    jobId: id,
    fit: scoreFit({ title: job.title, location: job.location, mode: job.mode, level: job.level, requirements: requirementsOf(job) }, await loadCandidate(userId)),
    letterEvidence: view.letter.paragraphs.filter((paragraph) => paragraph.purpose === "evidence").map((paragraph) => paragraph.text),
  }) : [];

  // One step at a time: attach a resume, finish the letter and the why, then apply and track.
  const letter = letterStatus(view.letter);
  const stage = application?.stage ?? null;
  const current = packetStep({ resumes: resumes.length, attached: Boolean(attached), letter, stage });
  const stateOf = (step: (typeof ORDER)[number]) =>
    current === "done" || ORDER.indexOf(step) < ORDER.indexOf(current) ? "done" : step === current ? "current" : "upcoming";
  const variantLabel = attached ? VARIANT_LABEL[attached.variant as keyof typeof VARIANT_LABEL] ?? attached.variant : null;
  const applyUrl = /^https?:\/\//.test(job.url) ? job.url : null;

  return (
    <PageBody className="max-w-4xl">
      <Link href={`/app/jobs/${id}`} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Back to job
      </Link>
      <PageHeader
        className="mt-4"
        title="Application packet"
        description={
          current === "done"
            ? `${job.title} at ${job.company}. Sent. Your tracker has the follow-up reminder.`
            : `${job.title} at ${job.company}. Three steps, in order, all built from your confirmed story.`
        }
      />

      {!canDraft && (
        <div role="alert" className="mt-5 rounded-lg border border-pending/40 bg-pending-soft px-4 py-3 text-[13.5px] text-pending-ink">
          Drafting for this job needs the full description. <Link href="/app#paste" className="underline underline-offset-2">Paste the posting on Today</Link>.
        </div>
      )}
      <div className="mt-8 space-y-3">
        <StepSection
          id="resume"
          index={1}
          title="Pick your resume"
          state={stateOf("resume")}
          summary={
            attached
              ? `Attached: ${variantLabel}, version ${attached.version}`
              : resumes.length
                ? `${resumes.length} ${resumes.length === 1 ? "version" : "versions"} built for this job`
                : "No tailored version yet"
          }
        >
          {resumes.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-[14px] leading-6 text-muted-foreground">
                Start here. Compare three one-page versions built from your confirmed facts and keep the one you can defend.
              </p>
              <Button size="lg" asChild>
                <Link href={`/app/resumes/compare?job=${id}`}>Compare resumes</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px]">
                {attached ? (
                  <>
                    Attached: <span className="font-medium">{variantLabel}</span>, version {attached.version}.
                  </>
                ) : (
                  <>
                    {resumes.length} {resumes.length === 1 ? "version" : "versions"} built for this job.{" "}
                    <span className="text-muted-foreground">Pick one to attach when you track it.</span>
                  </>
                )}
              </p>
              <div className="flex gap-2">
                {attached && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/app/resumes/${attached.id}`}>Review</Link>
                  </Button>
                )}
                <Button size="sm" variant={attached ? "ghost" : "default"} asChild>
                  <Link href={`/app/resumes/compare?job=${id}`}>{attached ? "Compare versions" : "Choose a version"}</Link>
                </Button>
              </div>
            </div>
          )}
        </StepSection>

        <StepSection
          id="letter"
          index={2}
          title="Cover letter and why you want it"
          state={stateOf("letter")}
          summary={
            letter === "ready" ? "Drafted, with your reason in your own words" : letter === "needs_you" ? "Drafted. Waiting on why you want this job" : "Not drafted yet"
          }
        >
          <p className="mb-4 text-[13px] leading-5 text-muted-foreground">
            Built from confirmed evidence. Each paragraph names the experience it came from. The one part only you can write is why you want this
            job. Downloads check every claim again first.
          </p>
          {letterCoaching.length > 0 && (
            <div className="mb-4 rounded-lg border bg-muted/40 p-3 text-[13px]">
              <p className="font-medium">Improve this letter for the posting</p>
              <ul className="mt-2 space-y-2 text-muted-foreground">
                {letterCoaching.slice(0, 2).map((step) => (
                  <li key={step.id}><Link href={step.href} className="font-medium text-foreground underline-offset-2 hover:underline">{step.title}</Link>. {step.detail}</li>
                ))}
              </ul>
            </div>
          )}
          <CoverLetterEditor
            jobId={id}
            company={job.company}
            signature={name}
            initialLetter={view.letter}
            canDraft={canDraft}
            initialWhy={view.why}
            checks={view.checks}
            sources={sources}
          />
          {view.letter && <FeedbackControl kind="cover_letter" subjectId={id} className="mt-6" />}
        </StepSection>

        <StepSection
          id="tracking"
          index={3}
          title="Apply, then track it"
          state={stateOf("track")}
          summary={application ? `In your tracker as ${STAGE_LABEL[application.stage]}` : "Not tracked yet"}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-lg text-[14px] leading-6">
              {application ? (
                <>
                  In your tracker as <span className="font-medium">{STAGE_LABEL[application.stage]}</span>.{" "}
                  <span className="text-muted-foreground">Move it to Applied after you submit, and I&apos;ll remind you when to follow up.</span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Submit on the employer&apos;s site, then track it here for follow-up reminders and a record of what you sent.
                </span>
              )}
            </p>
            <div className="flex gap-2">
              {applyUrl && (
                <Button size="lg" asChild>
                  <a href={applyUrl} target="_blank" rel="noreferrer">
                    Apply on their site
                    <ArrowUpRight data-icon="inline-end" />
                  </a>
                </Button>
              )}
              <Button size="lg" variant="outline" asChild>
                <Link href={application ? `/app/tracker?app=${application.id}` : "/app/tracker"}>Open tracker</Link>
              </Button>
            </div>
          </div>
        </StepSection>
      </div>

      <h2 className="mt-12 text-[13px] font-medium text-subtle-foreground">When you need them</h2>
      <div className="mt-3 space-y-3">
        <StepSection id="questions" index={null} title="Application questions" state="extra" summary="Draft short answers for the form's own questions">
          <p className="mb-4 text-[13px] leading-5 text-muted-foreground">
            Paste a short-answer question from the form. The draft uses your strongest matching evidence and leaves what only you know for you to write.
          </p>
          <ApplicationAnswers jobId={id} answers={view.answers} sources={sources} canDraft={canDraft} />
        </StepSection>
        <StepSection
          id="interview"
          index={null}
          title="Interview prep"
          state={stage === "interview" ? "current" : "extra"}
          summary={`${view.prep.length} likely questions, each paired with a story you already have`}
        >
          <p className="mb-4 text-[13px] leading-5 text-muted-foreground">
            Likely questions for this posting, each paired with the strongest story you already have. Proofline never fills in what only you know.
          </p>
          <InterviewPrep jobId={id} questions={view.prep} notes={view.notes} />
        </StepSection>
      </div>
    </PageBody>
  );
}
