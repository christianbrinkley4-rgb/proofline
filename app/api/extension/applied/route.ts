import { z } from "zod";
import { extensionUser, markApplied, unauthorized } from "@/lib/extension/service";
import { getJobForUser } from "@/lib/jobs/store";

export const dynamic = "force-dynamic";

/** The person says they submitted this application; record it on their tracker. */
export async function POST(request: Request) {
  const user = await extensionUser(request);
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null);
  const jobId = z.object({ jobId: z.uuid() }).safeParse(body);
  if (!jobId.success) return Response.json({ ok: false, error: "Save this job first." }, { status: 400 });
  if (!(await getJobForUser(user.userId, jobId.data.jobId))) return Response.json({ ok: false, error: "That job isn't on your account." }, { status: 404 });
  const applicationId = await markApplied(user.userId, jobId.data.jobId);
  const origin = new URL(request.url).origin;
  return Response.json({ ok: true, applicationId, url: `${origin}/app/tracker?app=${applicationId}` });
}
