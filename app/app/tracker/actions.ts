"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  addManualApplication,
  deleteApplication,
  moveApplication,
  trackJob,
  updateApplication,
  type Stage,
} from "@/lib/tracker/service";

async function userId() {
  return (await requireSession()).user.id;
}

function refresh() {
  revalidatePath("/app/tracker");
  revalidatePath("/app");
}

export async function trackJobAction(jobId: string, resumeId?: string) {
  await trackJob(await userId(), jobId, { resumeId });
  refresh();
}

export async function moveApplicationAction(id: string, stage: Stage, sortOrder?: number) {
  await moveApplication(await userId(), id, stage, sortOrder);
  refresh();
}

const NoteSchema = z.object({
  notes: z.string().max(5000).optional(),
  contacts: z.array(z.object({ name: z.string().min(1), role: z.string().optional(), email: z.string().optional() })).optional(),
  deadline: z.string().max(40).nullable().optional(),
});

export async function updateApplicationAction(id: string, patch: z.infer<typeof NoteSchema>) {
  const parsed = NoteSchema.safeParse(patch);
  if (!parsed.success) return;
  await updateApplication(await userId(), id, parsed.data);
  refresh();
}

export async function addManualApplicationAction(input: { company: string; title: string; url?: string }) {
  if (!input.company.trim() || !input.title.trim()) return;
  await addManualApplication(await userId(), { company: input.company.trim(), title: input.title.trim(), url: input.url?.trim() || undefined });
  refresh();
}

export async function deleteApplicationAction(id: string) {
  await deleteApplication(await userId(), id);
  refresh();
}

export async function snoozeFollowUpAction(id: string, days: number) {
  await updateApplication(await userId(), id, { nextFollowUpAt: new Date(Date.now() + days * 864e5) });
  refresh();
}
