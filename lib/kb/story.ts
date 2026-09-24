import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { notesToStatements, probeExperience } from "@/lib/agent/probe";
import { db, schema } from "@/lib/db";

export const StoryNoteSchema = z.object({
  body: z.string().trim().min(4, "Write a few words to save this note.").max(4000),
  context: z.string().trim().max(160).optional(),
  when: z.string().trim().max(100).optional(),
});
export const PromoteStorySchema = z.object({
  kind: z.enum(["work", "internship", "leadership", "project", "volunteer", "research"]),
  org: z.string().trim().min(1, "Name the place, project, or activity.").max(160),
  title: z.string().trim().max(160).optional(),
});
export type StoryNote = typeof schema.storyNote.$inferSelect;

export async function listStoryNotes(userId: string): Promise<StoryNote[]> {
  return db.query.storyNote.findMany({
    where: eq(schema.storyNote.userId, userId),
    orderBy: [desc(schema.storyNote.createdAt)],
  });
}
export async function createStoryNote(userId: string, input: z.input<typeof StoryNoteSchema>) {
  const note = StoryNoteSchema.parse(input);
  const [row] = await db.insert(schema.storyNote).values({
    userId, body: note.body, context: note.context || null, when: note.when || null,
  }).returning();
  return row;
}
export async function updateStoryNote(userId: string, id: string, input: z.input<typeof StoryNoteSchema>) {
  z.uuid().parse(id);
  const note = StoryNoteSchema.parse(input);
  const [row] = await db.update(schema.storyNote).set({
    body: note.body, context: note.context || null, when: note.when || null, updatedAt: new Date(),
  }).where(and(eq(schema.storyNote.id, id), eq(schema.storyNote.userId, userId), isNull(schema.storyNote.promotedExperienceId))).returning();
  if (!row) throw new Error("This note is already part of your evidence or no longer exists.");
  return row;
}
export async function deleteStoryNote(userId: string, id: string) {
  z.uuid().parse(id);
  await db.delete(schema.storyNote).where(and(eq(schema.storyNote.id, id), eq(schema.storyNote.userId, userId)));
}

/**
 * Promotion is explicit and atomic: a private draft becomes a structured experience.
 * The user's own statements become confirmed facts; questions invite more detail.
 */
export async function promoteStoryNote(userId: string, id: string, input: z.input<typeof PromoteStorySchema>) {
  z.uuid().parse(id);
  const details = PromoteStorySchema.parse(input);
  return db.transaction(async (tx) => {
    const [note] = await tx.select().from(schema.storyNote).where(and(eq(schema.storyNote.id, id), eq(schema.storyNote.userId, userId))).for("update");
    if (!note) throw new Error("Note not found.");
    if (note.promotedExperienceId) return note.promotedExperienceId;
    const statements = notesToStatements(note.body);
    if (!statements.length) throw new Error("Add more detail before using this note as evidence.");
    const [experience] = await tx.insert(schema.experience).values({
      userId, kind: details.kind, org: details.org, title: details.title || null, rawNotes: note.body,
    }).returning();
    for (const content of statements) {
      const [fact] = await tx.insert(schema.fact).values({
        userId, experienceId: experience.id, category: "experience", content,
        source: "user_stated", sourceDetail: "story_note", verificationState: "confirmed", confirmedAt: new Date(),
      }).returning();
      await tx.insert(schema.agentEvent).values({ userId, type: "fact_confirmed", data: { factId: fact.id, source: "story_note" } });
    }
    for (const question of probeExperience({ org: details.org, title: details.title, notes: note.body })) {
      await tx.insert(schema.question).values({
        userId, experienceId: experience.id, prompt: question.prompt, kind: question.kind,
        proposedValue: question.proposedValue ?? null, choices: question.choices ?? null,
        factTemplate: question.factTemplate ?? null, factCategory: question.factCategory ?? null,
        priority: question.priority ?? 0,
      });
    }
    await tx.update(schema.storyNote).set({ promotedExperienceId: experience.id, updatedAt: new Date() })
      .where(and(eq(schema.storyNote.id, id), eq(schema.storyNote.userId, userId)));
    return experience.id;
  });
}
