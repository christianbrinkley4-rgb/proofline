"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { addManualFact, deleteFact, deleteRole, editFact, FACT_GROUPS, saveRole } from "@/lib/facts/base";

export type FactActionResult = { ok: true } | { ok: false; error: string };

const CONFIRM_REQUIRED = "Tick the box to confirm this is true and in your own words.";

function refresh() {
  revalidatePath("/app", "layout");
}

async function run(fn: (userId: string) => Promise<unknown>): Promise<FactActionResult> {
  const userId = (await requireSession()).user.id;
  try {
    await fn(userId);
    refresh();
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the form." };
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong. Try again." };
  }
}

const AddSchema = z.object({
  group: z.enum(FACT_GROUPS),
  text: z.string().trim().min(2, "Write the fact first.").max(600, "Keep one fact under 600 characters."),
  experienceId: z.uuid().nullable().optional(),
  confirmed: z.literal(true, CONFIRM_REQUIRED),
});

/** Manual add. Only an explicit "this is true" makes a fact. */
export async function addFactAction(input: z.input<typeof AddSchema>) {
  return run(async (userId) => {
    const value = AddSchema.parse(input);
    await addManualFact(userId, value);
  });
}

const EditSchema = z.object({
  factId: z.uuid(),
  text: z.string().trim().min(1, "A fact can't be empty. Delete it instead.").max(600),
  confirmed: z.literal(true, CONFIRM_REQUIRED),
});

/** Editing re-confirms: the new wording replaces the old everywhere it was used. */
export async function editFactAction(input: z.input<typeof EditSchema>) {
  return run(async (userId) => {
    const value = EditSchema.parse(input);
    await editFact(userId, value.factId, value.text);
  });
}

export async function deleteFactAction(factId: string) {
  return run((userId) => deleteFact(userId, z.uuid().parse(factId)));
}

export async function deleteRoleAction(experienceId: string) {
  return run((userId) => deleteRole(userId, z.uuid().parse(experienceId)));
}

const Month = z.union([z.literal(""), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month.")]);

const RoleSchema = z.object({
  kind: z.enum(["work", "internship", "leadership", "volunteer", "project", "research"]),
  org: z.string().trim().min(1, "Name the company, organization, or project.").max(160),
  title: z.string().trim().max(160),
  startDate: Month,
  endDate: Month,
  bullets: z.array(z.string().trim().max(400)).max(6),
  confirmed: z.literal(true, CONFIRM_REQUIRED),
});

export async function addRoleAction(input: z.input<typeof RoleSchema>) {
  return run(async (userId) => {
    const value = RoleSchema.parse(input);
    if (value.startDate && value.endDate && value.startDate > value.endDate) throw new Error("The end date is before the start date.");
    await saveRole(userId, { ...value, bullets: value.bullets.filter((b) => b.length >= 3) }, "my-facts");
  });
}
