import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { importParsedResume } from "@/lib/kb/import";
import { updateProfile } from "@/lib/kb/profile";
import { isSupported, MAX_RESUME_BYTES, parseResume } from "@/lib/resume/parse";

export type UploadResponse =
  | {
      ok: true;
      method: "model" | "rules";
      basics: Record<string, string>;
      summary: { experiences: number; facts: number; skipped: number };
    }
  | { ok: false; error: string };

function fail(error: string, status = 400) {
  return NextResponse.json<UploadResponse>({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Sign in first.", 401);

  const form = await request.formData().catch(() => null);
  const file = form?.get("resume");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a PDF or DOCX file.");
  if (!isSupported(file)) return fail("That file type isn't supported. Upload a PDF or DOCX.");
  if (file.size > MAX_RESUME_BYTES) return fail("That file is over 5 MB. Try exporting a smaller PDF.");

  try {
    const { parsed, method } = await parseResume({ name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
    if (!parsed.entries.length && !parsed.education.length) {
      return fail("We couldn't read any sections from that file. If it's a scanned image, try a text-based PDF or start from scratch.", 422);
    }
    const userId = session.user.id;
    const summary = await importParsedResume(userId, parsed, file.name);
    const edu = parsed.education[0];
    const [city = "", region = ""] = (parsed.location ?? "").split(/,\s*/);
    const basics = {
      fullName: parsed.name ?? "",
      phone: parsed.phone ?? "",
      city,
      region,
      linkedinUrl: parsed.links.find((l) => l.includes("linkedin")) ?? "",
      portfolioUrl: parsed.links.find((l) => !l.includes("linkedin")) ?? "",
      school: edu?.school ?? "",
      degree: edu?.degree ?? "",
      major: edu?.major ?? "",
      minor: edu?.minor ?? "",
      gradDate: edu?.gradDate ?? "",
      gpa: edu?.gpa != null ? String(edu.gpa) : "",
    };
    // Kept as proposals so the form is still prefilled if the student leaves before confirming.
    await updateProfile(userId, { onboardingStep: "review", importedBasics: basics });
    revalidatePath("/app", "layout");
    return NextResponse.json<UploadResponse>({ ok: true, method, summary, basics });
  } catch {
    return fail("Something went wrong reading that file. Try a different export, or start from scratch.", 500);
  }
}
