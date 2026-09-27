type DatedWork = { kind: string; startDate: string | null; endDate: string | null };

/** A settled career leads with work; students and recent graduates lead with education. */
export function educationAfterExperience(gradDate: string | null, work: DatedWork[], today = new Date()): boolean {
  const currentYear = today.getUTCFullYear();
  const gradYear = gradDate ? Number(gradDate.slice(0, 4)) : null;
  if (gradYear && gradYear >= currentYear - 3) return false;
  const dated = work.filter((item) => ["work", "internship"].includes(item.kind) && item.startDate);
  if (!dated.length) return false;
  const earliest = Math.min(...dated.map((item) => Number(item.startDate!.slice(0, 4))));
  const latest = Math.max(...dated.map((item) => item.endDate ? Number(item.endDate.slice(0, 4)) : currentYear));
  return latest - earliest >= 5;
}
