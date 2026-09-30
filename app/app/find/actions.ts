"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logEvent } from "@/lib/agent/events";
import { requireSession } from "@/lib/auth";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { FeedFiltersSchema, FEED_TYPES, type FeedFilters } from "@/lib/jobs/feed/filters";
import { getJobForUser, keywordsOf, requirementsOf, saveMatches, setMatchStatus } from "@/lib/jobs/store";
import { updateProfile } from "@/lib/kb/profile";

const Id = z.uuid();

async function userId() {
  return (await requireSession()).user.id;
}

function refresh() {
  revalidatePath("/app/find");
  revalidatePath("/app/jobs");
}

/** Saves the filters from the form; the feed reopens with them next time. */
export async function saveFeedFiltersAction(form: FormData): Promise<void> {
  const id = await userId();
  const filters: FeedFilters = FeedFiltersSchema.parse({
    keywords: String(form.get("keywords") ?? ""),
    places: String(form.get("places") ?? ""),
    remote: form.get("remote") === "on",
    types: FEED_TYPES.filter((t) => form.getAll("types").includes(t)),
    minScore: Number(form.get("minScore") ?? 0) || 0,
  });
  await updateProfile(id, { feedFilters: filters as unknown as Record<string, unknown> });
  revalidatePath("/app/find");
}

/** Back to filters built from the profile's target roles and places. */
export async function resetFeedFiltersAction(): Promise<void> {
  await updateProfile(await userId(), { feedFilters: null });
  revalidatePath("/app/find");
}

/**
 * Every feed action stores the fit score with the status, so a job that lands under
 * Your jobs (saved, or restored after a dismissal) sits in its right place there.
 */
async function scoreAndSet(userId: string, jobId: string, status: "new" | "saved" | "dismissed") {
  const access = await getJobForUser(userId, Id.parse(jobId));
  if (!access) throw new Error("This job is not available to your account.");
  const { job } = access;
  const fit = scoreFit({ title: job.title, location: job.location, mode: job.mode, level: job.level, requirements: requirementsOf(job), keywords: keywordsOf(job) }, await loadCandidate(userId));
  await saveMatches(userId, [{ job, fit }]);
  await setMatchStatus(userId, job.id, status);
  return job;
}

export async function saveFeedJobAction(jobId: string): Promise<void> {
  const id = await userId();
  const job = await scoreAndSet(id, jobId, "saved");
  await logEvent(id, "job_saved", { jobId: job.id, via: "feed" });
  refresh();
}

export async function unsaveFeedJobAction(jobId: string): Promise<void> {
  await scoreAndSet(await userId(), jobId, "new");
  refresh();
}

export async function dismissFeedJobAction(jobId: string): Promise<void> {
  const id = await userId();
  const job = await scoreAndSet(id, jobId, "dismissed");
  await logEvent(id, "job_dismissed", { jobId: job.id, via: "feed", company: job.company, title: job.title, mode: job.mode, location: job.location });
  refresh();
}

/** Undo for a dismissal: the listing returns to the feed, saved again if it was saved. */
export async function undoDismissFeedJobAction(jobId: string, wasSaved: boolean): Promise<void> {
  await scoreAndSet(await userId(), jobId, wasSaved ? "saved" : "new");
  refresh();
}
