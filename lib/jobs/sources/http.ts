import { site } from "@/lib/site";

/** Identifies us to job boards, with a contact, as polite crawlers do. */
export const USER_AGENT = `ProoflineBot/0.1 (+${site.url}; ${site.contactEmail})`;

export class SourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export async function getJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 10000, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json", "user-agent": USER_AGENT, ...(rest.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new SourceError(`${res.status} from ${new URL(url).host}`, res.status);
  return (await res.json()) as T;
}

/** Runs `fn` over items with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
