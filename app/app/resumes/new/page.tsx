import type { Metadata } from "next";
import { TailorStarter } from "@/components/resume/tailor-starter";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Building your resume" };

export default async function NewResumePage({ searchParams }: PageProps<"/app/resumes/new">) {
  await requireSession();
  const { job: jobId, variant, template } = await searchParams;
  const id = typeof jobId === "string" ? jobId : null;
  const job = id ? await db.query.job.findFirst({ where: (j, { eq }) => eq(j.id, id) }) : null;
  return (
    <TailorStarter
      jobId={job?.id ?? null}
      jobLabel={job ? `${job.title} at ${job.company}` : null}
      variant={typeof variant === "string" ? variant : undefined}
      template={typeof template === "string" ? template : undefined}
    />
  );
}
