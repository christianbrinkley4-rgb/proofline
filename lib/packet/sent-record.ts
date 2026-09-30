import type { AnswerKit } from "./kit";

/**
 * What the person sent. Saved once, when they say they submitted, from the same
 * kit they were looking at. It never changes afterwards, like a submitted resume.
 * Kept free of server imports so the tracker can read it in the browser.
 */
export type SentRecord = { version: 1; at: string; resumeId: string | null; kit: AnswerKit };

export function readSent(value: unknown): SentRecord | null {
  const record = value as Partial<SentRecord> | null;
  if (!record || record.version !== 1 || typeof record.at !== "string" || !Array.isArray(record.kit?.groups)) return null;
  return record as SentRecord;
}

/** How many fields had an answer to paste, and how many were left blank. */
export function sentSummary(record: SentRecord): { filled: number; blank: number } {
  const fields = record.kit.groups.flatMap((g) => g.entries.flatMap((e) => e.fields));
  return { filled: fields.filter((f) => f.value).length, blank: fields.filter((f) => !f.value).length };
}
