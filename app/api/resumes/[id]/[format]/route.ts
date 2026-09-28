import { logEvent } from "@/lib/agent/events";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { blockedExportResponse, type ExportGateCheck } from "@/lib/export-gate";
import { exportBlocked } from "@/lib/resume/quality";
import { renderDocx, renderPdf } from "@/lib/resume/render";
import { freshChecks, getResume, resumeFileName } from "@/lib/resume/store";
import { gateStatus } from "@/lib/review/gate";

export async function GET(_request: Request, ctx: RouteContext<"/api/resumes/[id]/[format]">) {
  const session = await getSession();
  if (!session) return new Response("Sign in first.", { status: 401 });
  const { id, format } = await ctx.params;
  if (format !== "pdf" && format !== "docx") return new Response("Not found", { status: 404 });

  const stored = await getResume(session.user.id, id);
  if (!stored) return new Response("Not found", { status: 404 });

  // The quality gate runs again right before any file is built; reuse its layout.
  const { layout, checks } = await freshChecks(session.user.id, stored);
  if (exportBlocked(checks)) return blockedExportResponse(checks);

  // The review gate: every blocking linter check passes now, and the model said PASS
  // for exactly this resume against exactly these facts. No gate, no file.
  const gate = await gateStatus(session.user.id, stored, layout);
  if (!gate.canExport) {
    const failing: ExportGateCheck[] = gate.linter
      .filter((c) => c.severity === "BLOCKING" && !c.passed)
      .map((c) => ({ id: c.id, label: c.label, detail: `${c.detail} "${c.evidence_quote}"`, blocking: true, status: "fail" as const }));
    return blockedExportResponse(failing.length ? failing : [{ id: "review", label: "Review gate", detail: gate.reason ?? "The review hasn't passed yet.", blocking: true, status: "fail" }]);
  }

  const job = stored.row.jobId ? await db.query.job.findFirst({ where: (j, { eq }) => eq(j.id, stored.row.jobId!) }) : null;
  const filename = resumeFileName(stored.document.header.name, job?.company ?? null, format);
  await logEvent(session.user.id, "resume_exported", { resumeId: id, format, jobId: stored.row.jobId });
  await logEvent(session.user.id, "exported", { resumeId: id, format, jobId: stored.row.jobId });

  const body =
    format === "pdf"
      ? await renderPdf(stored.document, stored.template, `${stored.document.header.name} Resume`, layout)
      : new Uint8Array(await renderDocx(stored.document, stored.template, layout));
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
