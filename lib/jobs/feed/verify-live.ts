import { getJson, SourceError } from "../sources/http";
import type { NormalizedJob } from "../types";

/**
 * Asks the employer's own board whether one posting is still open, right now.
 * The daily refresh can be a day behind; this is the check made just before
 * anything is built for a role.
 *
 * "unconfirmed" means we could not tell (network error, a board we have no
 * single-posting check for). It is never treated as open.
 */
export type LiveCheck = "open" | "closed" | "unconfirmed";

/** Sources with a single-posting endpoint that answers 404 once the posting is gone. */
export const LIVE_CHECKABLE: ReadonlyArray<NormalizedJob["source"]> = ["greenhouse"];

type Fetch = typeof getJson;

export async function checkPostingOpen(source: NormalizedJob["source"], sourceId: string, fetchJson: Fetch = getJson): Promise<LiveCheck> {
  if (!LIVE_CHECKABLE.includes(source)) return "unconfirmed";
  const [slug, id] = sourceId.split(":");
  if (!slug || !id) return "unconfirmed";
  try {
    await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}`, { timeoutMs: 8000 });
    return "open";
  } catch (error) {
    return error instanceof SourceError && error.status === 404 ? "closed" : "unconfirmed";
  }
}
