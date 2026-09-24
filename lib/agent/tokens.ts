import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";

/**
 * Personal access tokens for connecting an outside AI over MCP. Only a hash is
 * stored; the token itself is shown once, when it's created.
 */

export type ApiToken = typeof schema.apiToken.$inferSelect;
export const TOKEN_PREFIX = "pl_";
const MAX_ACTIVE = 10;

export const TokenNameSchema = z.string().trim().min(1, "Name the connection, e.g. \"Claude\".").max(60);

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createToken(userId: string, name: string): Promise<{ token: string; row: ApiToken }> {
  const clean = TokenNameSchema.parse(name);
  const active = await listTokens(userId);
  if (active.length >= MAX_ACTIVE) throw new Error(`You can have up to ${MAX_ACTIVE} connections. Revoke one first.`);
  const token = `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
  const [row] = await db
    .insert(schema.apiToken)
    .values({ userId, name: clean, tokenHash: hashToken(token), prefix: token.slice(0, 10) })
    .returning();
  return { token, row };
}

export async function listTokens(userId: string): Promise<ApiToken[]> {
  return db.query.apiToken.findMany({
    where: and(eq(schema.apiToken.userId, userId), isNull(schema.apiToken.revokedAt)),
    orderBy: [desc(schema.apiToken.createdAt)],
  });
}

export async function revokeToken(userId: string, id: string): Promise<void> {
  await db
    .update(schema.apiToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.apiToken.id, z.uuid().parse(id)), eq(schema.apiToken.userId, userId)));
}

/** The user behind a bearer token, or null. Touches lastUsedAt at most once a minute. */
export async function authenticateToken(header: string | null): Promise<{ userId: string; tokenId: string; name: string } | null> {
  const token = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token || !token.startsWith(TOKEN_PREFIX) || token.length > 200) return null;
  const hash = hashToken(token);
  const row = await db.query.apiToken.findFirst({ where: eq(schema.apiToken.tokenHash, hash) });
  if (!row || row.revokedAt) return null;
  // The lookup is by hash already; compare again in constant time for good measure.
  if (!timingSafeEqual(Buffer.from(row.tokenHash, "hex"), Buffer.from(hash, "hex"))) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.update(schema.apiToken).set({ lastUsedAt: new Date() }).where(eq(schema.apiToken.id, row.id));
  }
  return { userId: row.userId, tokenId: row.id, name: row.name };
}
