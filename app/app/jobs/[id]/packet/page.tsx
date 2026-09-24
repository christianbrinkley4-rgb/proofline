import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowUpRight, FileText, ListChecks, MessagesSquare, PenLine, SquareKanban } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ApplicationAnswers } from "@/components/packet/application-answers";
import { CoverLetterEditor, type SourceView } from "@/components/packet/cover-letter-editor";
import { InterviewPrep } from "@/components/packet/interview-prep";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getProfile } from "@/lib/kb/profile";
import { packetView } from "@/lib/packet/service";
import { VARIANT_LABEL } from "@/lib/resume/document";
import { STAGE_LABEL } from "@/lib/tracker/model";

export async function generateMetadata({ params }: PageProps<"/app/jobs/[id]/packet">): Promise<Metadata> {
  const job = await db.query.job.findFirst({ where: eq(schema.job.id, (await params).id), columns: { company: true } }).catch(() => null);
  return { title: job ? `Packet for ${job.company}` : "Application packet" };
}

export default async function PacketPage({ params }: PageProps<"/app/jobs/[id]/packet">) {
  const session = await requireSession();
  const userId = session.user.id;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const job = await db.query.job.findFirst({ where: eq(schema.job.id, id) });
  if (!job) notFound();
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

  return (
    <PageBody className="max-w-4xl">
      <Link href={`/app/jobs/${id}`} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Back to job
      </Link>
      <PageHeader
        className="mt-4"
        title="Application packet"
        description={`${job.title} at ${job.company}. Everything you'll send and say, built from your confirmed story.`}
      />

      <nav aria-label="Packet sections" className="mt-6 flex flex-wrap gap-2 text-[13px]">
        {[
          ["#resume", "Resume", FileText],
          ["#letter", "Cover letter", PenLine],
          ["#questions", "Questions", ListChecks],
          ["#interview", "Interview prep", MessagesSquare],
          ["#tracking", "Tracking", SquareKanban],
        ].map(([href, label, Icon]) => {
          const I = Icon as typeof FileText;
          return (
            <a key={href as string} href={href as string} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 hover:bg-muted">
              <I className="size-3.5" />
              {label as string}
            </a>
          );
        })}
      </nav>

      <section id="resume" className="mt-8 scroll-mt-20 rounded-xl border bg-background p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold tracking-tight">Resume</h2>
        {resumes.length === 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13.5px] text-muted-foreground">No tailored version for this job yet.</p>
            <Button size="sm" asChild>
              <Link href={`/app/resumes/compare?job=${id}`}>Compare tailored resumes</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13.5px]">
              {attached ? (
                <>
                  Attached: <span className="font-medium">{VARIANT_LABEL[attached.variant as keyof typeof VARIANT_LABEL] ?? attached.variant}</span>, version {attached.version}.
                </>
              ) : (
                <>
                  {resumes.length} {resumes.length === 1 ? "version" : "versions"} built for this job. <span className="text-muted-foreground">Pick one to attach when you track it.</span>
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
      </section>

      <section id="letter" className="mt-6 scroll-mt-20 rounded-xl border bg-background p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-[17px] font-semibold tracking-tight">Cover letter</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Built from confirmed evidence. Hover a source to see the fact behind it. Downloads check every claim again first.
          </p>
        </div>
        <CoverLetterEditor
          jobId={id}
          company={job.company}
          signature={name}
          initialLetter={view.letter}
          initialWhy={view.why}
          checks={view.checks}
          sources={sources}
        />
      </section>

      <section id="questions" className="mt-6 scroll-mt-20 rounded-xl border bg-background p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold tracking-tight">Application questions</h2>
        <p className="mt-1 mb-4 text-[13px] leading-5 text-muted-foreground">
          Paste a short-answer question from the form. The draft uses your strongest matching evidence and leaves what only you know for you to write.
        </p>
        <ApplicationAnswers jobId={id} answers={view.answers} sources={sources} />
      </section>

      <section id="interview" className="mt-6 scroll-mt-20 rounded-xl border bg-background p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold tracking-tight">Interview prep</h2>
        <p className="mt-1 mb-4 text-[13px] leading-5 text-muted-foreground">
          Likely questions for this posting, each paired with the strongest story you already have. Proofline never fills in what only you know.
        </p>
        <InterviewPrep jobId={id} questions={view.prep} notes={view.notes} />
      </section>

      <section id="tracking" className="mt-6 scroll-mt-20 rounded-xl border bg-background p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold tracking-tight">Tracking</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13.5px]">
            {application ? (
              <>
                In your tracker as <span className="font-medium">{STAGE_LABEL[application.stage]}</span>.{" "}
                <span className="text-muted-foreground">Follow-up drafts and reminders live there.</span>
              </>
            ) : (
              <span className="text-muted-foreground">Not tracked yet. Track it to get follow-up reminders and a record of what you sent.</span>
            )}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={job.url} target="_blank" rel="noreferrer">
                Open the application
                <ArrowUpRight data-icon="inline-end" />
              </a>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/app/tracker">Open tracker</Link>
            </Button>
          </div>
        </div>
      </section>
    </PageBody>
  );
}
