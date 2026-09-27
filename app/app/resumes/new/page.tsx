import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TailorStarter } from "@/components/resume/tailor-starter";
import { requireSession } from "@/lib/auth";
import { getJobForUser } from "@/lib/jobs/store";

export const metadata: Metadata = { title: "Building your resume" };

export default async function NewResumePage({ searchParams }: PageProps<"/app/resumes/new">) {
  const session = await requireSession();
  const { job: jobId, variant, template } = await searchParams;
  const id = typeof jobId === "string" ? jobId : null;
  const data = id ? await getJobForUser(session.user.id, id) : null;
  if (id && !data) notFound();
  const job = data?.job ?? null;
  return (
    <TailorStarter
      jobId={job?.id ?? null}
      jobLabel={job ? `${job.title} at ${job.company}` : null}
      variant={typeof variant === "string" ? variant : undefined}
      template={typeof template === "string" ? template : undefined}
    />
  );
}
