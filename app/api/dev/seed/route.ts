import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listExperiences } from "@/lib/kb/experiences";
import { confirmFact, listFacts } from "@/lib/kb/facts";
import { importParsedResume } from "@/lib/kb/import";
import { updateProfile } from "@/lib/kb/profile";
import { generateBullets } from "@/lib/resume/bullets/service";
import { SAMPLE_RESUME } from "@/lib/resume/fixtures/sample";
import { parseResume } from "@/lib/resume/parse";
import { renderPdf } from "@/lib/resume/render";
import { TEMPLATES } from "@/lib/resume/templates";

/**
 * Development only: gives the signed-in test account a complete sample profile
 * (imported resume, confirmed facts, basics, goals, bullets) so every screen can
 * be exercised in one step. Returns 404 anywhere else.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (process.env.NODE_ENV !== "development" || !local) return new NextResponse("Not found", { status: 404 });
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/api/dev/login?next=/api/dev/seed", url));
  const userId = session.user.id;

  const bytes = await renderPdf(SAMPLE_RESUME, TEMPLATES.classic, "Sample resume");
  const { parsed } = await parseResume({ name: "sample-resume.pdf", type: "application/pdf", bytes });
  const imported = await importParsedResume(userId, parsed, "sample-resume.pdf");
  for (const fact of await listFacts(userId, { states: ["unconfirmed", "needs_review"] })) await confirmFact(userId, fact.id);

  const edu = parsed.education[0];
  await updateProfile(userId, {
    fullName: parsed.name ?? "Jordan Reyes",
    phone: parsed.phone,
    city: "Raleigh",
    region: "NC",
    linkedinUrl: parsed.links[0] ?? null,
    school: edu?.school ?? null,
    degree: edu?.degree ?? null,
    major: edu?.major ?? null,
    gradDate: edu?.gradDate ?? null,
    gpa: edu?.gpa ?? null,
    targetRoles: ["Accounting intern", "Audit intern", "Tax intern"],
    targetTerm: "Summer 2027",
    targetLocations: [],
    workModes: [],
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
  });

  let bullets = 0;
  for (const experience of await listExperiences(userId)) {
    const result = await generateBullets(userId, experience.id);
    bullets += result.created;
  }
  const next = url.searchParams.get("next");
  if (next?.startsWith("/")) return NextResponse.redirect(new URL(next, url));
  return NextResponse.json({ ok: true, imported, bullets });
}
