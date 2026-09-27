"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { recordCareerCheckin, setCareerGoal } from "@/lib/career/service";

const GoalInput = z.object({
  targetRole: z.string().trim().min(2).max(100),
  targetMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
  motivation: z.string().trim().max(500).nullable(),
  benchmarkJobId: z.uuid().nullable(),
});

export async function saveCareerGoalAction(form: FormData) {
  const userId = (await requireSession()).user.id;
  const input = GoalInput.parse({
    targetRole: form.get("targetRole"),
    targetMonth: form.get("targetMonth") || null,
    motivation: form.get("motivation") || null,
    benchmarkJobId: form.get("benchmarkJobId") || null,
  });
  await setCareerGoal(userId, input);
  revalidatePath("/app/career");
}

export async function recordCareerCheckinAction(form: FormData) {
  const userId = (await requireSession()).user.id;
  const goalId = z.uuid().parse(form.get("goalId"));
  const reflection = z.string().trim().max(1000).parse(form.get("reflection") ?? "");
  const completedActionId = z.string().max(100).parse(form.get("completedActionId") ?? "") || null;
  const result = await recordCareerCheckin(userId, goalId, reflection, completedActionId);
  revalidatePath("/app/career");
  return { created: result.created };
}
