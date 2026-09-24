"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TemplateId, VariantId } from "@/lib/resume/document";
import { saveTailoredResume, tailorResume } from "@/lib/resume/tailor";
import { defaultTemplateFor } from "@/lib/resume/templates";
import { parseIntent } from "@/lib/jobs/intent";

const VARIANTS: VariantId[] = ["experience", "skills", "ats"];
const TEMPLATE_IDS: TemplateId[] = ["classic", "technical"];

export async function createResumeAction(input: { jobId?: string | null; variant?: string; template?: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const userId = session.user.id;
  const variant = VARIANTS.includes(input.variant as VariantId) ? (input.variant as VariantId) : "experience";
  const job = input.jobId ? await db.query.job.findFirst({ where: (j, { eq }) => eq(j.id, input.jobId!) }) : null;
  if (input.jobId && !job) return { ok: false, error: "That job isn't available anymore." };

  const template = TEMPLATE_IDS.includes(input.template as TemplateId)
    ? (input.template as TemplateId)
    : defaultTemplateFor(job ? parseIntent(job.title).roles : []);

  const result = await tailorResume(userId, { jobId: job?.id ?? null, template, variant, email: session.user.email });
  const bulletCount = result.why.length;
  if (bulletCount === 0) {
    return { ok: false, error: "There are no confirmed bullets to put on a resume yet. Confirm some facts and write bullets on your profile first." };
  }
  const row = await saveTailoredResume(userId, job?.id ?? null, result, {
    variant,
    name: job ? `${job.title} at ${job.company}` : "General resume",
  });
  revalidatePath("/app/resumes");
  return { ok: true, id: row.id };
}
