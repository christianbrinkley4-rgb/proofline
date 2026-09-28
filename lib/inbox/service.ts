import { and, count, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";

/**
 * Messages the owner reads straight from the database (table inbox_message):
 * in-app feedback, the public contact form, and password-reset links when no
 * email provider is configured. Nothing here is emailed or sent anywhere else.
 */

export type InboxKind = "feedback" | "contact" | "password_reset";

export const FeedbackMessage = z.object({
  message: z.string().trim().min(3, "Write a few words first.").max(4000, "Keep it under 4,000 characters."),
  page: z.string().trim().max(300).optional(),
});

export const ContactMessage = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.email("Add an email so we can reply.").max(254),
  message: z.string().trim().min(10, "Write a little more so we can help.").max(4000, "Keep it under 4,000 characters."),
});

/** Keeps one person, or one address on the public form, from flooding the inbox. */
const DAILY_LIMIT: Record<InboxKind, number> = { feedback: 40, contact: 5, password_reset: 5 };

async function sentToday(kind: InboxKind, by: { userId?: string; email?: string }) {
  const since = new Date(Date.now() - 864e5);
  const [row] = await db
    .select({ total: count() })
    .from(schema.inboxMessage)
    .where(and(
      eq(schema.inboxMessage.kind, kind),
      gte(schema.inboxMessage.createdAt, since),
      by.userId ? eq(schema.inboxMessage.userId, by.userId) : by.email ? eq(schema.inboxMessage.email, by.email) : undefined,
    ));
  return row?.total ?? 0;
}

export class InboxLimitError extends Error {
  constructor() {
    super("You've sent a lot today. Try again tomorrow.");
  }
}

export async function saveFeedback(user: { id: string; email: string }, input: z.infer<typeof FeedbackMessage>) {
  const value = FeedbackMessage.parse(input);
  if ((await sentToday("feedback", { userId: user.id })) >= DAILY_LIMIT.feedback) throw new InboxLimitError();
  const [row] = await db
    .insert(schema.inboxMessage)
    .values({ kind: "feedback", userId: user.id, email: user.email, message: value.message, page: value.page ?? null })
    .returning();
  return row;
}

export async function saveContact(input: z.infer<typeof ContactMessage>) {
  const value = ContactMessage.parse(input);
  const email = value.email.toLowerCase();
  if ((await sentToday("contact", { email })) >= DAILY_LIMIT.contact) throw new InboxLimitError();
  const [row] = await db
    .insert(schema.inboxMessage)
    .values({ kind: "contact", email, name: value.name || null, message: value.message, page: "/contact" })
    .returning();
  return row;
}

/** Stores a reset link for the owner to pass on by hand when no email provider is set up. */
export async function savePasswordResetForOwner(user: { id: string; email: string }, url: string) {
  if ((await sentToday("password_reset", { userId: user.id })) >= DAILY_LIMIT.password_reset) return null;
  const [row] = await db
    .insert(schema.inboxMessage)
    .values({ kind: "password_reset", userId: user.id, email: user.email, message: `Password reset link for ${user.email} (works for 3 days, once): ${url}`, page: "/forgot-password" })
    .returning();
  return row;
}

export async function listInbox(kind: InboxKind, limit = 100) {
  return db.query.inboxMessage.findMany({ where: eq(schema.inboxMessage.kind, kind), orderBy: [desc(schema.inboxMessage.createdAt)], limit });
}
