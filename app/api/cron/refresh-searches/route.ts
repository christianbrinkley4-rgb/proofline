import { timingSafeEqual } from "node:crypto";
import { dbReady } from "@/lib/db";
import { refreshDue } from "@/lib/jobs/saved";

/**
 * Scheduled refresh of watched searches (see vercel.json). Requires
 * `Authorization: Bearer $CRON_SECRET`; without a configured secret it does nothing.
 * Searches also refresh when their owner opens Today, so this is a supplement.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  await dbReady;
  const refreshed = await refreshDue({ limit: 20 });
  return Response.json({ refreshed });
}
