"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { markSubmitted, type MarkSubmittedResult } from "@/lib/packet/sent";

/** The person says they submitted on the employer's site. Proofline records it; it never submits anything. */
export async function markSubmittedAction(jobId: string, digest: string): Promise<MarkSubmittedResult> {
  const session = await requireSession();
  const id = z.uuid().parse(jobId);
  const result = await markSubmitted(session.user.id, id, z.string().parse(digest), session.user.name);
  revalidatePath(`/app/jobs/${id}/kit`);
  revalidatePath(`/app/jobs/${id}/packet`);
  revalidatePath("/app/tracker");
  return result;
}
