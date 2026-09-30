import { cronAuthorized } from "@/lib/cron-auth";
import { dbReady } from "@/lib/db";
import { refreshFeed } from "@/lib/jobs/feed/refresh";

/**
 * Daily refresh of the Find jobs pool (see vercel.json). Requires
 * `Authorization: Bearer $CRON_SECRET`; without a configured secret it does nothing.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  await dbReady;
  // Stop starting new board reads well before the 300-second function limit; writing the pool takes the rest.
  const stats = await refreshFeed({ deadline: new Date(Date.now() + 150_000) });
  console.info("feed.refresh", JSON.stringify(stats));
  return Response.json(stats);
}
