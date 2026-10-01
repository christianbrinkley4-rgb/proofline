import { getJson, SourceError } from "../sources/http";
import type { NormalizedJob } from "../types";

/**
 * Asks the employer's own board whether one posting is still open, right now.
 * The daily refresh can be a day behind; this is the check made just before
 * anything is built for a role.
 *
 * "unconfirmed" means we could not tell (network error, a board we have no
 * check for). It is never treated as open.
 */
export type LiveCheck = "open" | "closed" | "unconfirmed";

type Source = NormalizedJob["source"];

/**
 * Boards that can answer for one posting. Greenhouse, Lever, and SmartRecruiters
 * have a single-posting endpoint that answers 404 once the posting is gone. Ashby
 * has none (its single-posting endpoint is private, and a job page answers 200 even
 * for a posting that never existed), so its public board list is read and the
 * posting is open if it is on it.
 */
export const LIVE_CHECKABLE: ReadonlyArray<Source> = ["greenhouse", "lever", "ashby", "smartrecruiters"];

/** Where each board says what it still lists. Ashby's list is large, so it gets longer to answer. */
const SINGLE: Partial<Record<Source, (slug: string, id: string) => string>> = {
  greenhouse: (slug, id) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}`,
  lever: (slug, id) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}/${encodeURIComponent(id)}`,
  smartrecruiters: (slug, id) => `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${encodeURIComponent(id)}`,
};

type Fetch = typeof getJson;

export async function checkPostingOpen(source: Source, sourceId: string, fetchJson: Fetch = getJson): Promise<LiveCheck> {
  if (!LIVE_CHECKABLE.includes(source)) return "unconfirmed";
  // A slug never contains a colon; the id is whatever follows the first one.
  const cut = sourceId.indexOf(":");
  const slug = cut > 0 ? sourceId.slice(0, cut) : "";
  const id = cut > 0 ? sourceId.slice(cut + 1) : "";
  if (!slug || !id) return "unconfirmed";
  try {
    if (source === "ashby") {
      const board = await fetchJson<{ jobs?: Array<{ id?: string }> }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`, { timeoutMs: 15000 });
      // A board that answers without a list is not evidence that anything closed.
      if (!Array.isArray(board?.jobs)) return "unconfirmed";
      return board.jobs.some((job) => job.id === id) ? "open" : "closed";
    }
    await fetchJson(SINGLE[source]!(slug, id), { timeoutMs: 8000 });
    return "open";
  } catch (error) {
    return error instanceof SourceError && error.status === 404 && source !== "ashby" ? "closed" : "unconfirmed";
  }
}
