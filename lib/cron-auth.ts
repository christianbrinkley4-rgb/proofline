import { timingSafeEqual } from "node:crypto";

/** Scheduled routes require `Authorization: Bearer $CRON_SECRET`; without a configured secret nothing runs. */
export function cronAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
