import type { LoopSummary } from "@/lib/agent/loop";

/** One sentence on what a run did. */
export function summaryMessage(s: LoopSummary): string {
  if (s.blocked && s.looked === 0) return s.blocked;
  if (s.looked === 0) return "Nothing new to check right now. New jobs arrive each morning, or loosen your filters in Find jobs.";
  const parts = [
    s.ready ? `${s.ready} ready` : null,
    s.needsYou ? `${s.needsYou} need${s.needsYou === 1 ? "s" : ""} you` : null,
    s.skipped ? `${s.skipped} skipped` : null,
    s.unconfirmed ? `${s.unconfirmed} couldn't be confirmed open` : null,
  ].filter(Boolean);
  return `Checked ${s.looked} job${s.looked === 1 ? "" : "s"}: ${parts.join(", ")}.${s.blocked ? ` ${s.blocked}` : ""}`;
}
