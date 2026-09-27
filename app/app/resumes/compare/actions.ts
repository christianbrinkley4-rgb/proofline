"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { defaultTemplateFor } from "@/lib/resume/templates";
import { parseIntent } from "@/lib/jobs/intent";
import { getJobForUser } from "@/lib/jobs/store";
import { hasUsableJobDescription, JOB_DESCRIPTION_REQUIRED } from "@/lib/jobs/description";
import { saveTailoredResume, tailorResume } from "@/lib/resume/tailor";
import type { VariantId } from "@/lib/resume/document";

export async function createVariantsAction(jobId: string): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!z.uuid().safeParse(jobId).success) return { ok: false, error: "Choose a job first." };
  const data = await getJobForUser(session.user.id, jobId);
  if (!data) return { ok: false, error: "This job is not available to your account." };
  const { job } = data;
  if (!hasUsableJobDescription(job.description)) return { ok: false, error: JOB_DESCRIPTION_REQUIRED };
  const template = defaultTemplateFor(parseIntent(job.title).roles);
  const ids: string[] = [];
  for (const variant of ["experience", "skills", "ats"] as VariantId[]) {
    const result = await tailorResume(session.user.id, { jobId, variant, template: variant === "ats" ? "technical" : template, email: session.user.email });
    if (!result.why.length) return { ok: false, error: "Add experience and confirmed bullets to your profile first." };
    const row = await saveTailoredResume(session.user.id, jobId, result, { variant, name: `${job.title} at ${job.company}` });
    ids.push(row.id);
  }
  revalidatePath("/app/resumes");
  revalidatePath("/app/resumes/compare");
  revalidatePath("/app/tracker");
  return { ok: true, ids };
}

