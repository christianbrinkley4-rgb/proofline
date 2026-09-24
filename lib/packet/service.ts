import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { logEvent } from "@/lib/agent/events";
import { db, schema } from "@/lib/db";
import { scoreFit } from "@/lib/fit/engine";
import { loadCandidate } from "@/lib/fit/candidate";
import { ROLE_FAMILIES } from "@/lib/jobs/roles";
import { requirementsOf, type JobRow } from "@/lib/jobs/store";
import { listExperiences } from "@/lib/kb/experiences";
import { listFacts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { COVER_LETTER_V1 } from "@/lib/llm/prompts/cover-letter.v1";
import { getLlm } from "@/lib/llm/provider";
import { listBullets } from "@/lib/resume/bullets/service";
import { verifyBullet } from "@/lib/resume/verify";
import {
  checkCoverLetter,
  CoverLetterSchema,
  draftCoverLetterOffline,
  WHY_PLACEHOLDER,
  type CoverLetter,
  type LetterContext,
  type LetterParagraph,
} from "./cover-letter";
import { rankEvidence, recencyOf, requirementLabels, type Evidence, type EvidenceInput } from "./evidence";
import { interviewPrep, type PrepQuestion } from "./interview";

export type Packet = typeof schema.applicationPacket.$inferSelect;

/** Fact categories that describe what someone did, as opposed to skills or preferences. */
const STORY_CATEGORIES = new Set(["experience", "metric", "leadership", "project", "award"]);

export type PacketContext = {
  job: JobRow;
  evidence: Evidence[];
  factText: Map<string, string>;
  matched: string[];
  missing: string[];
  letterContext: LetterContext;
  experiences: Array<{ org: string; title: string | null }>;
};

/** Confirmed evidence ranked for one job, plus what the posting asks for that the person hasn't shown. */
export async function loadPacketContext(userId: string, jobId: string): Promise<PacketContext | null> {
  z.uuid().parse(jobId);
  const job = await db.query.job.findFirst({ where: eq(schema.job.id, jobId) });
  if (!job) return null;
  const [profile, experiences, bullets, facts, candidate, application] = await Promise.all([
    getProfile(userId),
    listExperiences(userId),
    listBullets(userId),
    listFacts(userId, { states: ["confirmed"] }),
    loadCandidate(userId),
    db.query.application.findFirst({ where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)) }),
  ]);
  const requirements = requirementsOf(job);
  const expById = new Map(experiences.map((e) => [e.id, e]));
  const factText = new Map(facts.map((f) => [f.id, f.content]));

  const items: EvidenceInput[] = [];
  const cited = new Set<string>();
  for (const b of bullets) {
    const exp = expById.get(b.experienceId);
    if (!exp || b.status !== "active" || !b.factIds.length || !b.factIds.every((id) => factText.has(id))) continue;
    if (!verifyBullet(b.text, b.factIds.map((id) => factText.get(id)!)).ok) continue;
    b.factIds.forEach((id) => cited.add(id));
    items.push({
      id: b.id, kind: "bullet", text: b.text, experienceId: exp.id, org: exp.org, title: exp.title,
      factIds: b.factIds, quality: (b.score ?? 60) / 100 + (b.favorite ? 0.15 : 0), recency: recencyOf(exp.endDate),
    });
  }
  for (const f of facts) {
    if (cited.has(f.id) || !STORY_CATEGORIES.has(f.category) || f.content.length < 20) continue;
    const exp = f.experienceId ? expById.get(f.experienceId) : undefined;
    if (f.experienceId && !exp) continue;
    items.push({
      id: f.id, kind: "fact", text: f.content, experienceId: exp?.id ?? null, org: exp?.org ?? null, title: exp?.title ?? null,
      factIds: [f.id], quality: 0.55, recency: exp ? recencyOf(exp.endDate) : 0.6,
    });
  }

  const titleWords = ROLE_FAMILIES.filter((fam) => fam.titleWords.some((w) => job.title.toLowerCase().includes(w))).flatMap((fam) => fam.titleWords);
  const evidence = rankEvidence(items, requirementLabels(requirements), titleWords);
  const fit = scoreFit({ title: job.title, location: job.location, mode: job.mode, level: job.level, requirements }, candidate);
  const matched = fit.details.requiredSkills.matched.flatMap((m) => m.split(" or "));
  const shown = new Set(evidence.flatMap((e) => e.covers));

  const contact = application?.contacts?.find((c) => c.name?.trim());
  return {
    job,
    evidence,
    factText,
    matched: [...new Set([...matched.filter((m) => shown.has(m)), ...matched])],
    missing: fit.details.requiredSkills.missing,
    experiences: experiences.map((e) => ({ org: e.org, title: e.title })),
    letterContext: {
      name: profile?.fullName ?? "",
      school: profile?.school ?? null,
      degree: profile?.degree ?? null,
      major: profile?.major ?? null,
      gradDate: profile?.gradDate ?? null,
      company: job.company,
      title: job.title,
      contactName: contact?.name ?? null,
      evidence,
    },
  };
}

export async function getPacket(userId: string, jobId: string): Promise<Packet | undefined> {
  return db.query.applicationPacket.findFirst({
    where: and(eq(schema.applicationPacket.userId, userId), eq(schema.applicationPacket.jobId, jobId)),
  });
}

async function upsertPacket(userId: string, jobId: string, patch: Partial<Pick<Packet, "why" | "coverLetter" | "coverLetterAt" | "interviewNotes">>) {
  const [row] = await db
    .insert(schema.applicationPacket)
    .values({ userId, jobId, ...patch })
    .onConflictDoUpdate({
      target: [schema.applicationPacket.userId, schema.applicationPacket.jobId],
      set: { ...patch, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export function readLetter(packet: Packet | undefined): CoverLetter | null {
  const parsed = CoverLetterSchema.safeParse(packet?.coverLetter);
  return parsed.success ? parsed.data : null;
}

const ModelLetter = z.object({
  paragraphs: z.array(z.object({ text: z.string(), sourceIds: z.array(z.string()) })).min(1).max(4),
});

/** Model-written evidence paragraphs, kept only if every number traces to a cited fact. */
async function modelParagraphs(ctx: PacketContext): Promise<LetterParagraph[] | null> {
  const llm = getLlm();
  if (!llm || ctx.evidence.length === 0) return null;
  const top = ctx.evidence.slice(0, 8);
  const byId = new Map(top.map((e) => [e.id, e]));
  try {
    const out = await llm.generateObject({
      purpose: "packet.cover_letter",
      promptVersion: COVER_LETTER_V1.version,
      system: COVER_LETTER_V1.system,
      schema: ModelLetter,
      effort: "medium",
      input: JSON.stringify({
        posting: { company: ctx.job.company, title: ctx.job.title, asksFor: ctx.matched.concat(ctx.missing).slice(0, 12), description: (ctx.job.description ?? "").slice(0, 6000) },
        evidence: top.map((e) => ({ id: e.id, where: [e.title, e.org].filter(Boolean).join(" at "), text: e.text })),
      }),
    });
    const paragraphs: LetterParagraph[] = [];
    for (const p of out.paragraphs) {
      const sources = p.sourceIds.filter((id) => byId.has(id));
      if (!sources.length) return null;
      const facts = sources.flatMap((id) => byId.get(id)!.factIds.map((f) => ctx.factText.get(f)!).filter(Boolean));
      if (!verifyBullet(p.text, facts).ok) return null;
      paragraphs.push({ text: p.text.trim(), sourceIds: sources, purpose: "evidence" });
    }
    return paragraphs;
  } catch {
    return null;
  }
}

/** Drafts (or redrafts) the cover letter. The person's reason for applying is used as written. */
export async function draftCoverLetter(userId: string, jobId: string, why?: string | null): Promise<CoverLetter> {
  const ctx = await loadPacketContext(userId, jobId);
  if (!ctx) throw new Error("Job not found.");
  const existing = await getPacket(userId, jobId);
  const reason = why === undefined ? existing?.why ?? null : why?.trim() || null;
  const offline = draftCoverLetterOffline({ ...ctx.letterContext, why: reason });
  let letter = offline;
  const middle = await modelParagraphs(ctx);
  if (middle) {
    const keep = offline.paragraphs.filter((p) => p.purpose !== "evidence" && p.purpose !== "fit");
    letter = {
      ...offline,
      paragraphs: [keep[0], ...middle, ...keep.slice(1)],
      generator: "anthropic",
      promptVersion: COVER_LETTER_V1.version,
    };
  }
  await upsertPacket(userId, jobId, { why: reason, coverLetter: letter as unknown as Record<string, unknown>, coverLetterAt: new Date() });
  await logEvent(userId, "cover_letter_drafted", { jobId, generator: letter.generator, sources: letter.paragraphs.flatMap((p) => p.sourceIds) });
  return letter;
}

/** The person's edits. What changed is kept as a voice sample; the letter is theirs now. */
export async function saveCoverLetter(userId: string, jobId: string, input: CoverLetter): Promise<CoverLetter> {
  const next = CoverLetterSchema.parse(input);
  const before = readLetter(await getPacket(userId, jobId));
  const changed = !before || JSON.stringify(before.paragraphs.map((p) => p.text)) !== JSON.stringify(next.paragraphs.map((p) => p.text)) || before.greeting !== next.greeting || before.signoff !== next.signoff;
  const letter: CoverLetter = changed ? { ...next, generator: "user" } : next;
  await upsertPacket(userId, jobId, { coverLetter: letter as unknown as Record<string, unknown>, coverLetterAt: new Date() });
  if (changed && before) {
    const pairs = next.paragraphs
      .map((p, i) => ({ before: before.paragraphs[i]?.text ?? "", after: p.text }))
      .filter((pair) => pair.before !== pair.after && !pair.before.startsWith("["));
    await logEvent(userId, "cover_letter_edited", { jobId, edits: pairs.slice(0, 6) });
  }
  return letter;
}

export async function saveWhy(userId: string, jobId: string, why: string) {
  const text = z.string().trim().max(1200).parse(why);
  const packet = await getPacket(userId, jobId);
  const letter = readLetter(packet);
  // Filling the reason also fills the letter's placeholder, if it's still there.
  let coverLetter = packet?.coverLetter ?? null;
  if (letter && text) {
    const i = letter.paragraphs.findIndex((p) => p.purpose === "motivation");
    const job = await db.query.job.findFirst({ where: eq(schema.job.id, jobId), columns: { company: true } });
    if (i >= 0 && job && letter.paragraphs[i].text === WHY_PLACEHOLDER(job.company)) {
      const paragraphs = letter.paragraphs.map((p, j) => (j === i ? { ...p, text: /[.!?]$/.test(text) ? text : `${text}.` } : p));
      coverLetter = { ...letter, paragraphs } as unknown as Record<string, unknown>;
    }
  }
  await upsertPacket(userId, jobId, { why: text || null, coverLetter });
}

export async function saveInterviewNote(userId: string, jobId: string, questionId: string, note: string) {
  const id = z.string().regex(/^[a-z0-9-]{1,80}$/).parse(questionId);
  const text = z.string().max(4000).parse(note);
  const packet = await getPacket(userId, jobId);
  const notes = { ...(packet?.interviewNotes ?? {}) };
  if (text.trim()) notes[id] = text;
  else delete notes[id];
  await upsertPacket(userId, jobId, { interviewNotes: notes });
}

export type PacketView = {
  letter: CoverLetter | null;
  checks: ReturnType<typeof checkCoverLetter>;
  why: string;
  prep: PrepQuestion[];
  notes: Record<string, string>;
  evidence: Evidence[];
  matched: string[];
  missing: string[];
};

export async function packetView(userId: string, jobId: string): Promise<PacketView | null> {
  const [ctx, packet] = await Promise.all([loadPacketContext(userId, jobId), getPacket(userId, jobId)]);
  if (!ctx) return null;
  const letter = readLetter(packet);
  const evidenceById = new Map(ctx.evidence.map((e) => [e.id, e]));
  return {
    letter,
    checks: letter ? checkCoverLetter(letter, ctx.factText, evidenceById) : [],
    why: packet?.why ?? "",
    prep: interviewPrep({
      company: ctx.job.company,
      title: ctx.job.title,
      school: ctx.letterContext.school,
      major: ctx.letterContext.major,
      gradDate: ctx.letterContext.gradDate,
      evidence: ctx.evidence,
      matched: ctx.matched,
      missing: ctx.missing,
      experiences: ctx.experiences,
    }),
    notes: packet?.interviewNotes ?? {},
    evidence: ctx.evidence,
    matched: ctx.matched,
    missing: ctx.missing,
  };
}
