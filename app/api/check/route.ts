import { NextResponse } from "next/server";
import { defendReport, type DefendReport } from "@/lib/check/defend";
import { allowCheck, clientKey } from "@/lib/check/rate-limit";
import { isSupported, MAX_RESUME_BYTES, resumeToText } from "@/lib/resume/parse";
import { parseResumeText } from "@/lib/resume/parse/rules";

/**
 * The free "Can you defend every line?" check. No sign-in, rules only (no model
 * call), and nothing is stored or logged: the resume and posting are read, checked,
 * and dropped when the response is sent.
 */

export type CheckResponse = { ok: true; report: DefendReport } | { ok: false; error: string };

const fail = (error: string, status = 400) => NextResponse.json<CheckResponse>({ ok: false, error }, { status });

export async function POST(request: Request) {
  if (!allowCheck(clientKey(request))) return fail("That's a lot of checks in a few minutes. Try again in a little while.", 429);

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Paste your resume or choose a file.");
  const pasted = form.get("text");
  const file = form.get("resume");
  const job = form.get("job");
  const jobText = typeof job === "string" ? job.slice(0, 20_000) : "";

  let text: string;
  if (typeof pasted === "string" && pasted.trim()) {
    if (pasted.trim().length < 80) return fail("Paste a bit more: at least one job with a few bullets.");
    if (pasted.length > 30_000) return fail("That's longer than a resume. Paste one resume at a time.");
    text = pasted;
  } else if (file instanceof File && file.size > 0) {
    if (!isSupported(file)) return fail("Upload a PDF or DOCX, or paste the text.");
    if (file.size > MAX_RESUME_BYTES) return fail("That file is over 5 MB. Try exporting a smaller PDF.");
    try {
      text = await resumeToText({ name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
    } catch {
      return fail("We couldn't read that file. If it's a scanned image, paste the text instead.", 422);
    }
  } else {
    return fail("Paste your resume or choose a file.");
  }

  const parsed = parseResumeText(text.replace(/\r/g, ""));
  if (!parsed.entries.some((e) => e.bullets.length)) {
    return fail("We couldn't find any bullet points. Put each job under an Experience heading with its bullets below it, or paste the text instead of uploading.", 422);
  }
  return NextResponse.json<CheckResponse>({ ok: true, report: defendReport(parsed, jobText, text) }, { headers: { "Cache-Control": "no-store" } });
}
