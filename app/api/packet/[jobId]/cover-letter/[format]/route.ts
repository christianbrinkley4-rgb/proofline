import { and, desc, eq } from "drizzle-orm";
import { logEvent } from "@/lib/agent/events";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { blockedExportResponse } from "@/lib/export-gate";
import { getProfile } from "@/lib/kb/profile";
import { checkCoverLetter } from "@/lib/packet/cover-letter";
import { renderLetterDocx, renderLetterPdf } from "@/lib/packet/render-letter";
import { getPacket, loadPacketContext, readLetter } from "@/lib/packet/service";
import { resumeContactItems } from "@/lib/resume/header-contact";
import { TEMPLATES } from "@/lib/resume/templates";

const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function GET(_request: Request, ctx: RouteContext<"/api/packet/[jobId]/cover-letter/[format]">) {
  const session = await getSession();
  if (!session) return new Response("Sign in first.", { status: 401 });
  const { jobId, format } = await ctx.params;
  if (format !== "pdf" && format !== "docx") return new Response("Not found", { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return new Response("Not found", { status: 404 });

  const userId = session.user.id;
  const [packet, context, profile] = await Promise.all([getPacket(userId, jobId), loadPacketContext(userId, jobId), getProfile(userId)]);
  const letter = readLetter(packet);
  if (!letter || !context) return new Response("Not found", { status: 404 });

  // Same rule as resumes: check again right before any file is built.
  const checks = checkCoverLetter(letter, context.factText, new Map(context.evidence.map((e) => [e.id, e])));
  if (checks.some((c) => c.blocking && !c.ok)) return blockedExportResponse(checks);

  // Match the template of the resume prepared for this job, so the two look like a set.
  const resume = await db.query.resume.findFirst({
    where: and(eq(schema.resume.userId, userId), eq(schema.resume.jobId, jobId)),
    orderBy: [desc(schema.resume.createdAt)],
    columns: { template: true },
  });
  const template = TEMPLATES[resume?.template === "technical" ? "technical" : "classic"];
  const name = profile?.fullName || session.user.name;
  const header = {
    name,
    contact: resumeContactItems(profile),
    date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    recipient: [letter.greeting.startsWith("Dear Hiring Team") ? "Hiring Team" : letter.greeting.replace(/^Dear\s+|,$/g, ""), context.job.company],
  };
  await logEvent(userId, "resume_exported", { kind: "cover_letter", jobId, format });
  const body = format === "pdf" ? await renderLetterPdf(letter, header, template) : new Uint8Array(await renderLetterDocx(letter, header, template));
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${clean(name || "Cover-Letter")}-${clean(context.job.company)}-Cover-Letter.${format}"`,
      "cache-control": "no-store",
    },
  });
}
