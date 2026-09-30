import { z } from "zod";
import { extensionUser, unauthorized } from "@/lib/extension/service";
import { fillPlan, findJobForPage } from "@/lib/extension/kit";
import { getJobForUser } from "@/lib/jobs/store";
import { loadAnswerKit } from "@/lib/packet/kit-service";

export const dynamic = "force-dynamic";

const Body = z.object({ url: z.string().url().max(4000), jobId: z.uuid().optional() });

/**
 * The answer kit for the application open in this tab, as a fill plan. The
 * extension types these answers into the form for the person to check; it never submits.
 */
export async function POST(request: Request) {
  const user = await extensionUser(request);
  if (!user) return unauthorized();
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ ok: false, error: "Open the application form and try again." }, { status: 400 });
  const known = body.data.jobId && (await getJobForUser(user.userId, body.data.jobId)) ? body.data.jobId : null;
  const jobId = known ?? (await findJobForPage(user.userId, body.data.url));
  if (!jobId) return Response.json({ ok: false, notSaved: true, error: "This job isn't in Proofline yet." }, { status: 404 });
  const loaded = await loadAnswerKit(user.userId, jobId);
  if (!loaded) return Response.json({ ok: false, notSaved: true, error: "This job isn't in Proofline yet." }, { status: 404 });
  const origin = new URL(request.url).origin;
  return Response.json({ ok: true, plan: fillPlan(loaded.kit, origin) }, { headers: { "Cache-Control": "no-store" } });
}
