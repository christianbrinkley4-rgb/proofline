import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { applyLooseHonors, loadFactBase, readEducationRecords } from "@/lib/facts/base";
import { readScreens } from "@/lib/fit/knockouts";
import { getProfile } from "@/lib/kb/profile";
import { listFacts } from "@/lib/kb/facts";
import { VARIANT_LABEL, type VariantId } from "@/lib/resume/document";
import { resumeFileName, unpack } from "@/lib/resume/store";
import { checkCoverLetter, letterStatus, letterText, WHY_PLACEHOLDER } from "./cover-letter";
import { buildAnswerKit, type AnswerKit, type KitInput, type KitRole } from "./kit";
import { getPacket, loadPacketContext, readAnswers, readLetter } from "./service";

const ROLE_LINES = 4;

/** The resume this application uses: the one attached in the tracker, or the newest one built for the job. */
async function kitResume(userId: string, jobId: string) {
  const app = await db.query.application.findFirst({
    where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)),
    columns: { id: true, resumeId: true, stage: true, sent: true },
  });
  const row = app?.resumeId
    ? await db.query.resume.findFirst({ where: and(eq(schema.resume.id, app.resumeId), eq(schema.resume.userId, userId)) })
    : await db.query.resume.findFirst({ where: and(eq(schema.resume.userId, userId), eq(schema.resume.jobId, jobId)), orderBy: [desc(schema.resume.createdAt)] });
  return { app: app ?? null, resume: row ? unpack(row) : null };
}

/** Every input the kit needs, loaded for one job. Confirmed facts only. */
export async function loadAnswerKit(userId: string, jobId: string, signatureFallback = ""): Promise<{ kit: AnswerKit; resumeId: string | null; application: { id: string; stage: string; sent: boolean } | null } | null> {
  const [ctx, packet, profile, base, educationFacts, awards, attached] = await Promise.all([
    loadPacketContext(userId, jobId),
    getPacket(userId, jobId),
    getProfile(userId),
    loadFactBase(userId),
    listFacts(userId, { states: ["confirmed"], categories: ["education"] }),
    listFacts(userId, { states: ["confirmed"], categories: ["award"] }),
    kitResume(userId, jobId),
  ]);
  if (!ctx) return null;
  const { job, evidence, factText } = ctx;
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  const name = profile?.fullName || signatureFallback;

  // Lines for each role: the resume's own lines for this job first, then the strongest confirmed bullets.
  const resumeLines = new Map<string, Array<{ text: string; factIds: string[] }>>();
  for (const section of attached.resume?.document.sections ?? []) {
    if (section.kind !== "entries") continue;
    for (const entry of section.entries) resumeLines.set(entry.experienceId, entry.bullets.map((b) => ({ text: b.text, factIds: b.factIds })));
  }
  const roles: KitRole[] = base.roles
    .filter((r) => r.group === "experience")
    .map((r) => {
      const header = (field: string) => r.header.find((h) => h.field === field);
      const org = header("org");
      const title = header("title");
      const location = header("location");
      const dates = header("dates");
      const fromEvidence = evidence.filter((e) => e.kind === "bullet" && e.experienceId === r.experience.id).map((e) => ({ text: e.text, factIds: e.factIds }));
      const lines = (resumeLines.get(r.experience.id) ?? fromEvidence).slice(0, ROLE_LINES);
      return {
        experienceId: r.experience.id,
        org: { text: org?.text ?? r.experience.org, factId: org?.id ?? null },
        title: title ? { text: title.text, factId: title.id } : null,
        location: location ? { text: location.text, factId: location.id } : null,
        dates: dates ? { start: r.experience.startDate, end: r.experience.endDate, factId: dates.id } : null,
        lines,
      };
    })
    .sort((a, b) => {
      const end = (r: KitRole) => (r.dates && !r.dates.end && r.dates.start ? "9999-99" : r.dates?.end ?? "");
      return end(b).localeCompare(end(a)) || (b.dates?.start ?? "").localeCompare(a.dates?.start ?? "");
    });

  const letter = readLetter(packet);
  let kitLetter: KitInput["letter"] = null;
  if (letter) {
    const checks = checkCoverLetter(letter, factText, evidenceById);
    const motivation = letter.paragraphs.find((p) => p.purpose === "motivation");
    kitLetter = {
      text: letterText(letter, name),
      factIds: letter.paragraphs.flatMap((p) => p.sourceIds.flatMap((id) => evidenceById.get(id)?.factIds ?? [])),
      usesOwnWords: letter.generator === "user" || Boolean(motivation && motivation.text !== WHY_PLACEHOLDER(job.company)),
      status: letterStatus(letter),
      blocked: checks.some((c) => c.blocking && !c.ok),
    };
  }

  const answers = readAnswers(packet).map((a) => ({
    id: a.id,
    question: a.question,
    answer: a.answer,
    factIds: [...new Set(a.sourceIds.flatMap((id) => evidenceById.get(id)?.factIds ?? []))],
    sourcesChanged: a.sourceIds.some((id) => !evidenceById.has(id)),
    ownWords: a.generator === "user",
  }));

  const resume = attached.resume;
  const kit = buildAnswerKit({
    job: { id: job.id, company: job.company, title: job.title, asksCitizenship: (job.screens as { citizenship?: boolean } | null)?.citizenship ?? readScreens(job.title, job.description).citizenship },
    profile: profile
      ? {
          fullName: profile.fullName, contactEmail: profile.contactEmail, phone: profile.phone, city: profile.city, region: profile.region,
          linkedinUrl: profile.linkedinUrl, portfolioUrl: profile.portfolioUrl, workAuthorization: profile.workAuthorization,
          availableFrom: profile.availableFrom, openToRelocate: profile.openToRelocate,
        }
      : null,
    education: applyLooseHonors(readEducationRecords(educationFacts), awards.map((a) => ({ id: a.id, content: a.content }))),
    roles,
    skills: base.skill.map((s) => ({ id: s.id, text: s.text })),
    licenses: base.license.map((s) => ({ id: s.id, text: s.text })),
    resume: resume
      ? {
          id: resume.row.id,
          fileName: resumeFileName(resume.document.header.name || name, job.company, "pdf"),
          label: `Your resume for this job (${VARIANT_LABEL[resume.variant as VariantId] ?? resume.variant}, version ${resume.row.version})`,
        }
      : null,
    letter: kitLetter,
    answers,
    factText,
  });
  return {
    kit,
    resumeId: resume?.row.id ?? null,
    application: attached.app ? { id: attached.app.id, stage: attached.app.stage, sent: Boolean(attached.app.sent) } : null,
  };
}
