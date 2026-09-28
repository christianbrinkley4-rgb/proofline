import { logEvent } from "@/lib/agent/events";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { linkManualApplication } from "@/lib/tracker/service";
import { pastedJob, type PastedJob } from "./sources/pasted";
import { keywordsOf, requirementsOf, saveMatches, setMatchStatus, upsertJobs } from "./store";

/**
 * A posting the person brought in themselves (pasted, or captured by the browser
 * extension): stored, scored against their facts, saved to their jobs, and linked
 * to a tracker entry they already typed in for it.
 */
export async function ingestPastedJob(userId: string, input: PastedJob, via: "pasted" | "extension" = "pasted") {
  const rows = await upsertJobs([pastedJob(userId, input)]);
  const row = [...rows.values()][0];
  const candidate = await loadCandidate(userId);
  const fit = scoreFit({ title: row.title, location: row.location, mode: row.mode, level: row.level, requirements: requirementsOf(row), keywords: keywordsOf(row) }, candidate);
  await saveMatches(userId, [{ job: row, fit }]);
  await setMatchStatus(userId, row.id, "saved");
  await linkManualApplication(userId, row);
  await logEvent(userId, "job_saved", { jobId: row.id, via });
  await logEvent(userId, "job_ingested", { jobId: row.id, via, keywords: keywordsOf(row).length });
  return { job: row, fit };
}
