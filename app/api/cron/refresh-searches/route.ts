import { cronAuthorized } from "@/lib/cron-auth";
import { dbReady } from "@/lib/db";
import { refreshDue } from "@/lib/jobs/saved";

/**
 * Scheduled refresh of watched searches (see vercel.json). Requires
 * `Authorization: Bearer $CRON_SECRET`; without a configured secret it does nothing.
 * On Vercel Hobby the scheduler runs once daily. Searches can also refresh
 * after a Today visit or when their owner presses "Check now".
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  await dbReady;
  // Stop starting new searches before the 300-second function limit.
  const refreshed = await refreshDue({ limit: 20, deadline: new Date(Date.now() + 210_000) });
  return Response.json({ refreshed });
}
