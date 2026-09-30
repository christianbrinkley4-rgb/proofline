/**
 * Small in-memory limits, per key (a client address, an account). They reset
 * when a server instance restarts and aren't shared between instances; they're
 * there to stop casual hammering, not a determined abuser.
 */
export type Limit = { readonly count: number; readonly windowMs: number };

export function rateLimiter(limit: Limit) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < limit.windowMs);
    if (recent.length >= limit.count) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      // Drop keys with nothing recent so the map can't grow without bound.
      for (const [k, times] of hits) if (!times.some((t) => now - t < limit.windowMs)) hits.delete(k);
    }
    return true;
  };
}

export const CHECK_LIMIT = { count: 12, windowMs: 10 * 60 * 1000 } as const;

/** The free public check, per client address. */
export const allowCheck = rateLimiter(CHECK_LIMIT);

/** The first address in x-forwarded-for (set by Vercel), else a shared bucket. */
export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
