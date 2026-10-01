import { runScheduled } from "@/lib/agent/schedule";
import { cronAuthorized } from "@/lib/cron-auth";
import { dbReady } from "@/lib/db";

/**
 * The morning run for people who turned it on (see vercel.json). Requires
 * `Authorization: Bearer $CRON_SECRET`; without a configured secret it does nothing.
 * Each person's run takes up to about two minutes, so one call serves a few people
 * and the cron fires more than once; a person already run today is skipped.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  await dbReady;
  // Stop starting a new person well before the 300-second limit; a run in progress needs the rest.
  const stats = await runScheduled({ deadline: new Date(Date.now() + 150_000) });
  console.info("loop.scheduled", JSON.stringify(stats));
  return Response.json(stats);
}
