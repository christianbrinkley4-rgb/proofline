import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** One visible chat turn. Tool calls are kept as names so the transcript shows what the agent did. */
export type ChatRecord = { id: string; role: "user" | "assistant"; text: string; tools: Array<{ name: string; ok: boolean }>; at: string };

type Stored = { text?: unknown; tools?: unknown };

function toRecord(row: typeof schema.chatMessage.$inferSelect): ChatRecord | null {
  if (row.role !== "user" && row.role !== "assistant") return null;
  const content = (row.content ?? {}) as Stored;
  if (typeof content.text !== "string") return null;
  const tools = Array.isArray(content.tools)
    ? content.tools.filter((t): t is { name: string; ok: boolean } => typeof t?.name === "string" && typeof t?.ok === "boolean")
    : [];
  return { id: row.id, role: row.role, text: content.text, tools, at: row.createdAt.toISOString() };
}

/** The most recent turns, oldest first. */
export async function listChat(userId: string, limit = 60): Promise<ChatRecord[]> {
  const rows = await db.query.chatMessage.findMany({
    where: eq(schema.chatMessage.userId, userId),
    orderBy: [desc(schema.chatMessage.createdAt)],
    limit,
  });
  return rows.reverse().flatMap((r) => toRecord(r) ?? []);
}

export async function appendChat(userId: string, role: "user" | "assistant", text: string, tools: ChatRecord["tools"] = []) {
  await db.insert(schema.chatMessage).values({ userId, role, content: { text, tools } });
}

export async function clearChat(userId: string) {
  await db.delete(schema.chatMessage).where(eq(schema.chatMessage.userId, userId));
}

