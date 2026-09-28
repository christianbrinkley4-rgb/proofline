import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { draftFromResume, type ResumeDraft } from "@/lib/onboarding/draft";
import { isSupported, MAX_RESUME_BYTES, parseResume, parseResumeText } from "@/lib/resume/parse";

/**
 * Reads a resume into the onboarding form. It stores nothing: the person checks
 * each screen and confirms it before anything becomes a fact.
 */

export type DraftResponse = { ok: true; draft: ResumeDraft } | { ok: false; error: string };

const fail = (error: string, status = 400) => NextResponse.json<DraftResponse>({ ok: false, error }, { status });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Sign in first.", 401);
  const form = await request.formData().catch(() => null);
  const file = form?.get("resume");
  const pasted = form?.get("text");
  try {
    let result;
    if (typeof pasted === "string" && pasted.trim()) {
      if (pasted.trim().length < 80) return fail("Paste a bit more: at least a job or two with what you did.");
      if (pasted.length > 30_000) return fail("That's longer than a resume. Paste one at a time.");
      result = await parseResumeText(pasted, session.user.id);
    } else if (file instanceof File && file.size > 0) {
      if (!isSupported(file)) return fail("Upload a PDF or DOCX, or paste the text.");
      if (file.size > MAX_RESUME_BYTES) return fail("That file is over 5 MB. Try exporting a smaller PDF.");
      result = await parseResume({ name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }, session.user.id);
    } else {
      return fail("Choose a PDF or DOCX, or paste your resume.");
    }
    const draft = draftFromResume(result.parsed);
    if (!draft.roles.length && !draft.basics.school) {
      return fail("We couldn't read any sections from that. If it's a scanned image, paste the text instead, or fill in the form yourself.", 422);
    }
    return NextResponse.json<DraftResponse>({ ok: true, draft }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("We couldn't read that file. Try pasting the text instead.", 422);
  }
}
