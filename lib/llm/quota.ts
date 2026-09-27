import { and, count, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** One credit is one possible provider request. Chat reserves its maximum steps up front. */
export class ModelQuotaError extends Error {
  constructor(public readonly resetAt: Date, public readonly scope: "account" | "platform" = "account") {
    super(scope === "platform"
      ? "The beta's AI capacity is full for today. Try again tomorrow."
      : "Today's AI usage limit has been reached. Try again tomorrow.");
  }
}

export function dailyModelCredits(): number {
  const configured = Number(process.env.PROOFLINE_DAILY_MODEL_CREDITS);
  return Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 1000)
    : 40;
}

/** A shared ceiling prevents open signup from multiplying provider calls across accounts. */
export function platformDailyModelCredits(): number {
  const configured = Number(process.env.PROOFLINE_DAILY_PLATFORM_MODEL_CREDITS);
  return Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 10_000)
    : 80;
}

export async function reserveModelCredits(
  userId: string,
  purpose: string,
  credits = 1,
  now = new Date(),
  limit = dailyModelCredits(),
  platformLimit = platformDailyModelCredits(),
) {
  if (!Number.isInteger(credits) || credits < 1 || credits > 20) throw new Error("Invalid model credit request.");
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const resetAt = new Date(start.getTime() + 86_400_000);
  return db.transaction(async (tx) => {
    const day = start.toISOString().slice(0, 10);
    await tx.insert(schema.modelDailyBudget).values({ day, creditsUsed: 0 }).onConflictDoNothing();
    // Lock the shared row first, then the account. Every instance uses this order.
    const [platform] = await tx.select({ creditsUsed: schema.modelDailyBudget.creditsUsed })
      .from(schema.modelDailyBudget).where(eq(schema.modelDailyBudget.day, day)).for("update");
    if (platform.creditsUsed + credits > platformLimit) throw new ModelQuotaError(resetAt, "platform");
    // Serialize all reservations for this account, even across Vercel instances.
    const [account] = await tx.select({ id: schema.user.id }).from(schema.user)
      .where(eq(schema.user.id, userId)).for("update");
    if (!account) throw new Error("Account not found.");
    const [usage] = await tx.select({ total: count() }).from(schema.agentEvent).where(and(
      eq(schema.agentEvent.userId, userId),
      eq(schema.agentEvent.type, "model_credit_reserved"),
      gte(schema.agentEvent.createdAt, start),
    ));
    if (usage.total + credits > limit) throw new ModelQuotaError(resetAt);
    await tx.update(schema.modelDailyBudget).set({ creditsUsed: platform.creditsUsed + credits })
      .where(eq(schema.modelDailyBudget.day, day));
    await tx.insert(schema.agentEvent).values(Array.from({ length: credits }, () => ({
      userId, type: "model_credit_reserved", data: { purpose }, createdAt: now,
    })));
    return { used: usage.total + credits, limit, resetAt };
  });
}