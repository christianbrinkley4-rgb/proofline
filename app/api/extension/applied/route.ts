import { z } from "zod";
import { extensionUser, markApplied, unauthorized } from "@/lib/extension/service";
import { getJobForUser } from "@/lib/jobs/store";
import { markSubmitted } from "@/lib/packet/sent";

export const dynamic = "force-dynamic";

/**
 * The person says they submitted this application; record it on their tracker.
 * With the digest of the kit the extension filled from, that kit is kept as what they sent.
 */
export async function POST(request: Request) {
  const user = await extensionUser(request);
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null);
  const jobId = z.object({ jobId: z.uuid(), digest: z.string().regex(/^[0-9a-f]{32}$/).optional() }).safeParse(body);
  if (!jobId.success) return Response.json({ ok: false, error: "Save this job first." }, { status: 400 });
  if (!(await getJobForUser(user.userId, jobId.data.jobId))) return Response.json({ ok: false, error: "That job isn't on your account." }, { status: 404 });
  const origin = new URL(request.url).origin;
  const kitUrl = `${origin}/app/jobs/${jobId.data.jobId}/kit`;
  let recorded: "sent" | "stale" | "already" | null = null;
  if (jobId.data.digest) {
    const result = await markSubmitted(user.userId, jobId.data.jobId, jobId.data.digest);
    recorded = result.ok ? "sent" : result.reason;
  }
  const applicationId = await markApplied(user.userId, jobId.data.jobId);
  return Response.json({ ok: true, applicationId, recorded, kitUrl, url: `${origin}/app/tracker?app=${applicationId}` });
}
