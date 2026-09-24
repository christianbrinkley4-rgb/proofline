import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";

export type Experience = typeof schema.experience.$inferSelect;
export type ExperienceKind = Experience["kind"];
export type ExperienceInput = Pick<Experience, "kind" | "org"> &
  Partial<Pick<Experience, "title" | "location" | "startDate" | "endDate" | "rawNotes">>;

/** "2025-05", or just "2025" when an import only had the year. */
const Month = z.union([z.literal(""), z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, "Use a month like 2025-05.")]);

/** What a person can change about an experience after it's on their profile. */
export const ExperienceDetailsSchema = z
  .object({
    kind: z.enum(["work", "internship", "leadership", "project", "volunteer", "research", "education"]),
    org: z.string().trim().min(1, "Name the place, project, or activity.").max(160),
    title: z.string().trim().max(160),
    location: z.string().trim().max(120),
    startDate: Month,
    /** Empty while it's ongoing. */
    endDate: Month,
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "The end date is before the start date.",
    path: ["endDate"],
  });
export type ExperienceDetails = z.infer<typeof ExperienceDetailsSchema>;

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
    .set({ ...input, updatedAt: new Date() })
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
