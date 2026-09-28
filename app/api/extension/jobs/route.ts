import { extensionUser, unauthorized } from "@/lib/extension/service";
import { ingestPastedJob } from "@/lib/jobs/ingest";
import { PastedJobSchema } from "@/lib/jobs/sources/pasted";

export const dynamic = "force-dynamic";

/** Saves the posting on the page the person is viewing, scored against their facts. */
export async function POST(request: Request) {
  const user = await extensionUser(request);
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null);
  const parsed = PastedJobSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "We couldn't read this posting." }, { status: 400 });
  const { job, fit } = await ingestPastedJob(user.userId, parsed.data, "extension");
  const origin = new URL(request.url).origin;
  return Response.json({ ok: true, jobId: job.id, title: job.title, company: job.company, fit: fit.score, url: `${origin}/app/jobs/${job.id}` });
}
