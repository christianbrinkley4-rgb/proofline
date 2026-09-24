import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageBody } from "@/components/app/page-header";
import { ResumeWorkspace } from "@/components/resume/resume-workspace";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TemplateId } from "@/lib/resume/document";
import { exportBlocked } from "@/lib/resume/quality";
import { freshChecks, getResume } from "@/lib/resume/store";

export const metadata: Metadata = { title: "Resume" };

export default async function ResumePage({ params }: PageProps<"/app/resumes/[id]">) {
  const session = await requireSession();
  const stored = await getResume(session.user.id, (await params).id);
  if (!stored) notFound();
  const { layout, checks } = await freshChecks(session.user.id, stored);
  const job = stored.row.jobId ? await db.query.job.findFirst({ where: (j, { eq }) => eq(j.id, stored.row.jobId!) }) : null;

  return (
    <PageBody className="max-w-7xl">
      <Link href={job ? `/app/jobs/${job.id}` : "/app/resumes"} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
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
    </PageBody>
  );
}
