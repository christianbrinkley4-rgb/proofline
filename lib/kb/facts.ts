import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { logEvent } from "@/lib/agent/events";
import { db, schema } from "@/lib/db";

export type Fact = typeof schema.fact.$inferSelect;
export type FactCategory = Fact["category"];
export type FactSource = Fact["source"];
export type VerificationState = Fact["verificationState"];

export type FactInput = {
  category: FactCategory;
  content: string;
  data?: Record<string, unknown> | null;
  experienceId?: string | null;
  source: FactSource;
  sourceDetail?: string | null;
};

/**
 * The verification rules, in one place:
 *
 * - Only the user can confirm a fact. Anything the system or an outside AI adds starts unconfirmed.
 * - Something the user typed directly about themselves counts as confirmed.
 * - Facts are never edited or deleted. A change supersedes the old row; a "no" rejects it.
 */
export function initialState(source: FactSource): VerificationState {
  return source === "user_stated" ? "confirmed" : "unconfirmed";
}

/** Current (not superseded, not rejected) facts, newest first within each state. */
export async function listFacts(
  userId: string,
  opts: { states?: VerificationState[]; experienceId?: string; categories?: FactCategory[] } = {},
): Promise<Fact[]> {
  const states = opts.states ?? ["confirmed", "unconfirmed", "needs_review"];
  return db.query.fact.findMany({
    where: and(
      eq(schema.fact.userId, userId),
      isNull(schema.fact.supersededAt),
      inArray(schema.fact.verificationState, states),
      opts.experienceId ? eq(schema.fact.experienceId, opts.experienceId) : undefined,
      opts.categories ? inArray(schema.fact.category, opts.categories) : undefined,
    ),
    orderBy: [asc(schema.fact.createdAt)],
  });
}

export async function getFact(userId: string, factId: string): Promise<Fact | undefined> {
  return db.query.fact.findFirst({ where: and(eq(schema.fact.id, factId), eq(schema.fact.userId, userId)) });
}

/** Adds a fact. Its verification state comes from its source, never from the caller. */
export async function addFact(userId: string, input: FactInput): Promise<Fact> {
  const state = initialState(input.source);
  const [row] = await db
    .insert(schema.fact)
    .values({
      userId,
      category: input.category,
      content: input.content.trim(),
      data: input.data ?? null,
      experienceId: input.experienceId ?? null,
      source: input.source,
      sourceDetail: input.sourceDetail ?? null,
      verificationState: state,
      confirmedAt: state === "confirmed" ? new Date() : null,
    })
    .returning();
  await logEvent(userId, state === "confirmed" ? "fact_confirmed" : "fact_proposed", {
    factId: row.id,
    source: input.source,
  });
  return row;
}

export async function confirmFact(userId: string, factId: string): Promise<Fact | undefined> {
  const [row] = await db
    .update(schema.fact)
    .set({ verificationState: "confirmed", confirmedAt: new Date() })
    .where(and(eq(schema.fact.id, factId), eq(schema.fact.userId, userId), isNull(schema.fact.supersededAt)))
    .returning();
  if (row) await logEvent(userId, "fact_confirmed", { factId });
  return row;
}

export async function rejectFact(userId: string, factId: string, reason?: string): Promise<Fact | undefined> {
  const [row] = await db
    .update(schema.fact)
    .set({ verificationState: "rejected" })
    .where(and(eq(schema.fact.id, factId), eq(schema.fact.userId, userId), isNull(schema.fact.supersededAt)))
    .returning();
  if (row) await logEvent(userId, "fact_rejected", { factId, reason: reason ?? null, content: row.content });
  return row;
}

/**
 * Replaces a fact with a corrected version. The old row stays for history.
 * A correction the user types is confirmed; one from the system is not.
 */
export async function reviseFact(
  userId: string,
  factId: string,
  change: { content: string; data?: Record<string, unknown> | null; source?: FactSource },
): Promise<Fact | undefined> {
  const old = await getFact(userId, factId);
  if (!old || old.supersededAt) return undefined;
  const source = change.source ?? "user_stated";
  const state = initialState(source);
  return db.transaction(async (tx) => {
    const [next] = await tx
      .insert(schema.fact)
      .values({
        userId,
        category: old.category,
        content: change.content.trim(),
        data: change.data === undefined ? old.data : change.data,
        experienceId: old.experienceId,
        source,
        sourceDetail: old.sourceDetail,
        verificationState: state,
        confirmedAt: state === "confirmed" ? new Date() : null,
        supersedesId: old.id,
      })
      .returning();
    await tx.update(schema.fact).set({ supersededAt: new Date() }).where(eq(schema.fact.id, old.id));
    await tx.insert(schema.agentEvent).values({
      userId,
      type: "fact_revised",
      data: { from: old.id, to: next.id, before: old.content, after: next.content },
    });
    return next;
  });
}

/** Every version of a fact, oldest first, following the supersede chain back. */
export async function factHistory(userId: string, factId: string): Promise<Fact[]> {
  const chain: Fact[] = [];
  let current = await getFact(userId, factId);
  while (current) {
    chain.unshift(current);
    current = current.supersedesId ? await getFact(userId, current.supersedesId) : undefined;
  }
  return chain;
}

export async function factCounts(userId: string) {
  const rows = await listFacts(userId);
  return {
    confirmed: rows.filter((f) => f.verificationState === "confirmed").length,
    toReview: rows.filter((f) => f.verificationState !== "confirmed").length,
  };
}

export async function recentlyRejected(userId: string, limit = 50): Promise<Fact[]> {
  return db.query.fact.findMany({
    where: and(eq(schema.fact.userId, userId), eq(schema.fact.verificationState, "rejected")),
    orderBy: [desc(schema.fact.createdAt)],
    limit,
  });
}
