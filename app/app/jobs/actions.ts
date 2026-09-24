"use server";

import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/agent/events";
import { requireSession } from "@/lib/auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { importJobLink, LinkImportError } from "@/lib/jobs/sources/link";
import { markViewed, refreshSearch, unwatchSearch, watchSearch } from "@/lib/jobs/saved";
import { requirementsOf, saveMatches, setMatchStatus, upsertJobs } from "@/lib/jobs/store";

async function userId() {
  return (await requireSession()).user.id;
}

export async function saveJobAction(jobId: string) {
  const id = await userId();
  await setMatchStatus(id, jobId, "saved");
  await logEvent(id, "job_saved", { jobId });
  revalidatePath("/app/jobs");
}

export async function unsaveJobAction(jobId: string) {
  await setMatchStatus(await userId(), jobId, "new");
  revalidatePath("/app/jobs");
}

/** A dismissal with a reason is one of the strongest learning signals the agent gets. */
export async function dismissJobAction(jobId: string, reason?: string) {
  const id = await userId();
  await setMatchStatus(id, jobId, "dismissed", reason);
  const job = await db.query.job.findFirst({ where: (j, { eq }) => eq(j.id, jobId) });
  await logEvent(id, "job_dismissed", { jobId, reason: reason ?? null, company: job?.company, title: job?.title, mode: job?.mode, location: job?.location });
  revalidatePath("/app/jobs");
}

export async function importLinkAction(url: string): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const id = await userId();
  try {
    const job = await importJobLink(url);
    const rows = await upsertJobs([job]);
    const row = rows.get(`${job.source}|${job.sourceId}`)!;
    const candidate = await loadCandidate(id);
    const fit = scoreFit({ title: row.title, location: row.location, mode: row.mode, level: row.level, requirements: requirementsOf(row) }, candidate);
    await saveMatches(id, [{ job: row, fit }]);
    await setMatchStatus(id, row.id, "saved");
    await logEvent(id, "job_saved", { jobId: row.id, via: "link" });
    revalidatePath("/app/jobs");
    return { ok: true, jobId: row.id };
  } catch (error) {
    return { ok: false, error: error instanceof LinkImportError ? error.message : "We couldn't read that posting. Try another link." };
  }
}

/** Watches a search; the results already on screen count as seen. */
export async function saveSearchAction(query: string, shownJobIds: string[] = []): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await watchSearch(await userId(), query, shownJobIds);
  } catch (error) {
    return { ok: false, error: error instanceof Error && !(error instanceof z.ZodError) ? error.message : "Couldn't watch that search." };
  }
  revalidatePath("/app");
  revalidatePath("/app/jobs");
  return { ok: true };
}

export async function unwatchSearchAction(id: string) {
  await unwatchSearch(await userId(), id);
  revalidatePath("/app");
  revalidatePath("/app/jobs");
}

export async function refreshSearchAction(id: string) {
  const result = await refreshSearch(await userId(), id);
  revalidatePath("/app");
  revalidatePath("/app/jobs");
  return result;
}

export async function markSearchViewedAction(id: string) {
  await markViewed(await userId(), id);
  revalidatePath("/app");
}
