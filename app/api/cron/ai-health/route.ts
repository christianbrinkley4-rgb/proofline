import { dbReady } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import { saveOwnerAlert } from "@/lib/inbox/service";
import { checkAiHealth } from "@/lib/review/health";

/**
 * Daily check that the AI review answers (see vercel.json). A failure is logged
 * and left in the owner inbox, so a billing or key problem shows up before testers hit it.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  await dbReady;
  const health = await checkAiHealth();
  const ok = health.review.ok && health.wording.ok;
  console[ok ? "info" : "error"]("ai.health", JSON.stringify(health));
  if (!ok) await saveOwnerAlert(`AI review check failed (${health.model}). Resume review: ${health.review.detail} Fact wording: ${health.wording.detail}`);
  return Response.json(health, { status: ok ? 200 : 503 });
}
