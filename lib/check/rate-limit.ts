/**
 * A small in-memory limit for the public check, per client address. It resets
 * when a server instance restarts and isn't shared between instances; it's there
 * to stop casual hammering, not a determined abuser.
 */
const hits = new Map<string, number[]>();

export const CHECK_LIMIT = { count: 12, windowMs: 10 * 60 * 1000 } as const;

export function allowCheck(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < CHECK_LIMIT.windowMs);
  if (recent.length >= CHECK_LIMIT.count) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    // Drop addresses with nothing recent so the map can't grow without bound.
    for (const [k, times] of hits) if (!times.some((t) => now - t < CHECK_LIMIT.windowMs)) hits.delete(k);
  }
  return true;
}

/** The first address in x-forwarded-for (set by Vercel), else a shared bucket. */
export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
