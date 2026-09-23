import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type Profile = typeof schema.profile.$inferSelect;
export type ProfileUpdate = Partial<Omit<typeof schema.profile.$inferInsert, "userId" | "createdAt" | "updatedAt">>;

/** Every signed-in user has exactly one profile row; create it on first visit. */
export async function ensureProfile(userId: string, fullName?: string | null): Promise<Profile> {
  const existing = await db.query.profile.findFirst({ where: eq(schema.profile.userId, userId) });
  if (existing) return existing;
  const [created] = await db
    .insert(schema.profile)
    .values({ userId, fullName: fullName ?? null })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.query.profile.findFirst({ where: eq(schema.profile.userId, userId) }))!;
}

export async function getProfile(userId: string): Promise<Profile | undefined> {
  return db.query.profile.findFirst({ where: eq(schema.profile.userId, userId) });
}

export async function updateProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
  await ensureProfile(userId);
  const [row] = await db.update(schema.profile).set(update).where(eq(schema.profile.userId, userId)).returning();
  return row;
}
