import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { gapId } from "@/lib/fit/gaps";

/**
 * Skills the student said they haven't done yet. Remembered across jobs so the
 * coach doesn't ask about SQL on every posting; answering later clears it.
 * Stored as agent events, so there's a record of when and for which job.
 */
export async function declinedSkills(userId: string): Promise<Set<string>> {
  const events = await db.query.agentEvent.findMany({
    where: and(eq(schema.agentEvent.userId, userId), inArray(schema.agentEvent.type, ["gap_declined", "gap_answered"])),
    orderBy: [asc(schema.agentEvent.createdAt)],
    columns: { type: true, data: true },
  });
  const declined = new Set<string>();
  for (const e of events) {
    const id = gapId(String(e.data.skill ?? ""));
    if (!id) continue;
    if (e.type === "gap_declined") declined.add(id);
    else declined.delete(id);
  }
  return declined;
}
