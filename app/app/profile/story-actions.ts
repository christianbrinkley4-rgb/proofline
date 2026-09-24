"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createStoryNote, deleteStoryNote, promoteStoryNote, PromoteStorySchema, StoryNoteSchema, updateStoryNote } from "@/lib/kb/story";

function refresh() {
  revalidatePath("/app/profile");
  revalidatePath("/app/agent");
  revalidatePath("/app");
}

export async function createStoryNoteAction(input: z.input<typeof StoryNoteSchema>) {
  const session = await requireSession();
  const row = await createStoryNote(session.user.id, StoryNoteSchema.parse(input));
  refresh();
  return { id: row.id };
}
export async function updateStoryNoteAction(id: string, input: z.input<typeof StoryNoteSchema>) {
  const session = await requireSession();
  await updateStoryNote(session.user.id, z.uuid().parse(id), StoryNoteSchema.parse(input));
  refresh();
}
export async function deleteStoryNoteAction(id: string) {
  const session = await requireSession();
  await deleteStoryNote(session.user.id, z.uuid().parse(id));
  refresh();
}
export async function promoteStoryNoteAction(id: string, input: z.input<typeof PromoteStorySchema>) {
  const session = await requireSession();
  const experienceId = await promoteStoryNote(session.user.id, z.uuid().parse(id), PromoteStorySchema.parse(input));
  refresh();
  return { experienceId };
}
