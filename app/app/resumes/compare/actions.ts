"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { defaultTemplateFor } from "@/lib/resume/templates";
import { parseIntent } from "@/lib/jobs/intent";
import { hasUsableJobDescription, JOB_DESCRIPTION_REQUIRED } from "@/lib/jobs/description";
import { saveTailoredResume, tailorResume } from "@/lib/resume/tailor";
import type { VariantId } from "@/lib/resume/document";
import { eq } from "drizzle-orm";

export async function createVariantsAction(jobId: string): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!z.uuid().safeParse(jobId).success) return { ok: false, error: "Choose a job first." };
  const job = await db.query.job.findFirst({ where: eq(schema.job.id, jobId) });
  if (!job) return { ok: false, error: "This job is no longer available." };
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

