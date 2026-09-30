import { logEvent } from "@/lib/agent/events";
import { extensionUser, unauthorized } from "@/lib/extension/service";
import { ScoreRequestSchema, scorePosting } from "@/lib/extension/score";

export const dynamic = "force-dynamic";

/** Scores the posting open on a job site against the person's confirmed facts. Nothing about the posting is stored. */
export async function POST(request: Request) {
  const user = await extensionUser(request);
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null);
  const parsed = ScoreRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Couldn't read this posting." }, { status: 400 });
  const result = await scorePosting(user.userId, parsed.data);
  // For the beta funnel: that a score was shown, and how high. Not the posting.
  await logEvent(user.userId, "extension_scored", { score: result.score, knockout: result.knockouts.some((k) => k.status === "knockout") });
  const origin = new URL(request.url).origin;
  return Response.json({ ok: true, ...result, factsUrl: `${origin}/app/facts` }, { headers: { "Cache-Control": "no-store" } });
}
