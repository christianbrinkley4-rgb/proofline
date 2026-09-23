import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type Experience = typeof schema.experience.$inferSelect;
export type ExperienceKind = Experience["kind"];
export type ExperienceInput = Pick<Experience, "kind" | "org"> &
  Partial<Pick<Experience, "title" | "location" | "startDate" | "endDate" | "rawNotes">>;

/** Current experiences, most recent first (ongoing roles on top). */
export async function listExperiences(userId: string): Promise<Experience[]> {
  const rows = await db.query.experience.findMany({
    where: and(eq(schema.experience.userId, userId), isNull(schema.experience.archivedAt)),
    orderBy: [asc(schema.experience.sortOrder), desc(schema.experience.startDate)],
  });
  return rows.sort((a, b) => {
    if (!a.endDate !== !b.endDate) return a.endDate ? 1 : -1;
    return (b.endDate ?? b.startDate ?? "").localeCompare(a.endDate ?? a.startDate ?? "");
  });
}

export async function getExperience(userId: string, id: string): Promise<Experience | undefined> {
  return db.query.experience.findFirst({
    where: and(eq(schema.experience.id, id), eq(schema.experience.userId, userId)),
  });
}

export async function createExperience(userId: string, input: ExperienceInput): Promise<Experience> {
  const [row] = await db
    .insert(schema.experience)
    .values({
      userId,
      kind: input.kind,
      org: input.org.trim(),
      title: input.title?.trim() || null,
      location: input.location?.trim() || null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      rawNotes: input.rawNotes?.trim() || null,
    })
    .returning();
  return row;
}

export async function updateExperience(userId: string, id: string, input: Partial<ExperienceInput>): Promise<Experience | undefined> {
  const [row] = await db
    .update(schema.experience)
    .set(input)
    .where(and(eq(schema.experience.id, id), eq(schema.experience.userId, userId)))
    .returning();
  return row;
}

/** Experiences are archived, not deleted, so facts and sent resumes keep their references. */
export async function archiveExperience(userId: string, id: string): Promise<void> {
  await db
    .update(schema.experience)
    .set({ archivedAt: new Date() })
    .where(and(eq(schema.experience.id, id), eq(schema.experience.userId, userId)));
}
