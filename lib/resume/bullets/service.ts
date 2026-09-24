import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { logEvent } from "@/lib/agent/events";
import { db, schema } from "@/lib/db";
import { getExperience } from "@/lib/kb/experiences";
import { listFacts, type Fact } from "@/lib/kb/facts";
import { askQuestion } from "@/lib/kb/questions";
import { BULLETS_V1 } from "@/lib/llm/prompts/bullets.v1";
import { getLlm } from "@/lib/llm/provider";
import { scoreBullet } from "../bullet-score";
import { draftFromStatement, withMetric } from "../rewrite";
import { verifyBullet } from "../verify";

export type Bullet = typeof schema.bullet.$inferSelect;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const BulletsOutput = z.object({
  bullets: z.array(z.object({ text: z.string(), factIds: z.array(z.string()) })),
  questions: z.array(z.object({ prompt: z.string(), factTemplate: z.string() })),
});

export async function listBullets(userId: string, experienceIds?: string[], includeArchived = false): Promise<Bullet[]> {
  return db.query.bullet.findMany({
    where: and(
      eq(schema.bullet.userId, userId),
      experienceIds ? inArray(schema.bullet.experienceId, experienceIds) : undefined,
      includeArchived ? undefined : inArray(schema.bullet.status, ["draft", "active"]),
    ),
    orderBy: [desc(schema.bullet.favorite), desc(schema.bullet.score)],
  });
}

/** Recent edits the student made to drafts. The model imitates them; they are the student's voice. */
async function voiceSamples(userId: string, limit = 6): Promise<Array<{ before: string; after: string }>> {
  const events = await db.query.agentEvent.findMany({
    where: and(eq(schema.agentEvent.userId, userId), eq(schema.agentEvent.type, "bullet_edited")),
    orderBy: [desc(schema.agentEvent.createdAt)],
    limit,
  });
  return events.map((e) => ({ before: String(e.data.before ?? ""), after: String(e.data.after ?? "") }));
}

type Candidate = { text: string; factIds: string[]; generator: "anthropic" | "offline" | "resume" };

/** Rules-only drafts: confirmed resume lines stay as the student wrote them; spoken notes get cleaned up. */
function offlineCandidates(facts: Fact[]): Candidate[] {
  const statements = facts.filter((f) => f.category === "experience");
  const metrics = facts.filter((f) => f.category === "metric" || f.category === "leadership");
  const unusedMetrics = [...metrics];
  const out: Candidate[] = [];

  for (const fact of statements) {
    if (fact.source === "resume_parsed") {
      out.push({ text: fact.content.replace(/[.\s]+$/, ""), factIds: [fact.id], generator: "resume" });
      continue;
    }
    let text = draftFromStatement(fact.content);
    const factIds = [fact.id];
    if (!/\d/.test(text) && unusedMetrics.length) {
      const metric = unusedMetrics.shift()!;
      text = withMetric(text, metric.content);
      factIds.push(metric.id);
    }
    out.push({ text, factIds, generator: "offline" });
  }
  // Metrics nobody used can stand alone when they read like an accomplishment ("Led a team of 5 people").
  for (const metric of unusedMetrics) {
    if (/^[A-Z][a-z]+ed\b/.test(metric.content)) {
      out.push({ text: metric.content.replace(/\s*\([^)]*\)\s*$/, ""), factIds: [metric.id], generator: "offline" });
    }
  }
  return out;
}

async function modelCandidates(userId: string, org: string, title: string | null, facts: Fact[], requirements?: string[]) {
  const llm = getLlm();
  if (!llm) return null;
  const voice = await voiceSamples(userId);
  const input = [
    `Experience: ${title ? `${title} at ` : ""}${org}`,
    "",
    "Confirmed facts (id: text):",
    ...facts.map((f) => `- ${f.id}: ${f.content}`),
    requirements?.length ? `\nThe target job asks for: ${requirements.join("; ")}. Favor facts that answer these.` : "",
    voice.length ? `\nVoice samples (draft -> what the student changed it to):\n${voice.map((v) => `- "${v.before}" -> "${v.after}"`).join("\n")}` : "",
    "\nWrite 2 to 4 bullets.",
  ].join("\n");
  try {
    return await llm.generateObject({
      purpose: "bullets.generate",
      promptVersion: BULLETS_V1.version,
      system: BULLETS_V1.system,
      input,
      schema: BulletsOutput,
      effort: "medium",
    });
  } catch {
    return null;
  }
}

export type GenerateResult = { created: number; held: number; questions: number; method: "model" | "rules" };

/**
 * Writes bullets for one experience. Every bullet is checked against the facts it
 * cites; one with a number the student never confirmed is held as a draft and
 * turned into a yes/no question instead of going on a resume.
 */
export async function generateBullets(userId: string, experienceId: string, requirements?: string[]): Promise<GenerateResult> {
  const experience = await getExperience(userId, experienceId);
  if (!experience) throw new Error("Experience not found");
  const facts = await listFacts(userId, { experienceId, states: ["confirmed"] });
  const byId = new Map(facts.map((f) => [f.id, f]));
  const existing = await listBullets(userId, [experienceId], true);
  const seen = new Set(existing.map((b) => norm(b.text)));

  const model = await modelCandidates(userId, experience.org, experience.title, facts, requirements);
  const candidates: Candidate[] = model
    ? model.bullets.map((b) => ({ text: b.text, factIds: b.factIds.filter((id) => byId.has(id)), generator: "anthropic" as const }))
    : offlineCandidates(facts);

  let created = 0;
  let held = 0;
  let questions = 0;

  for (const candidate of candidates) {
    const text = candidate.text.trim().replace(/[.]+$/, "");
    if (!text || seen.has(norm(text))) continue;
    seen.add(norm(text));

    const cited = candidate.factIds.map((id) => byId.get(id)!.content);
    const check = verifyBullet(text, cited);
    // A model can make an unsupported qualitative claim even when every number is sourced.
    const grounded = candidate.generator !== "anthropic" || facts.some((fact) => norm(fact.content) === norm(text));
    const approved = check.ok && grounded;
    const { score, checks } = scoreBullet(text);

    const [row] = await db
      .insert(schema.bullet)
      .values({
        userId,
        experienceId,
        text,
        status: approved ? "active" : "draft",
        factIds: candidate.factIds,
        score,
        scoreDetail: { checks, verified: approved, unsupported: check.unsupported },
        generator: candidate.generator === "resume" ? "user" : candidate.generator,
        promptVersion: candidate.generator === "anthropic" ? BULLETS_V1.version : null,
      })
      .returning();

    if (approved) {
      created++;
    } else {
      held++;
      // Ask before anything unconfirmed can reach a resume.
      await askQuestion(userId, {
        experienceId,
        bulletId: row.id,
        kind: "yes_no",
        prompt: `Is this accurate? "${text}"`,
        proposedValue: text,
        factTemplate: "{answer}",
        factCategory: "experience",
        priority: 10,
      });
      questions++;
    }
  }

  if (model) {
    for (const q of model.questions.slice(0, 3)) {
      await askQuestion(userId, { experienceId, kind: "text", prompt: q.prompt, factTemplate: q.factTemplate, factCategory: "metric", priority: 8 });
      questions++;
    }
  }

  await logEvent(userId, "bullet_generated", { experienceId, created, held, method: model ? "model" : "rules" });
  return { created, held, questions, method: model ? "model" : "rules" };
}

/**
 * The student edited a bullet. The edit is a new row (the old one is archived, so
 * sent resumes keep their text), a voice sample for the agent, and a new
 * confirmed fact containing the student's full revision.
 */
export async function editBullet(userId: string, bulletId: string, text: string): Promise<Bullet | undefined> {
  const old = await db.query.bullet.findFirst({ where: and(eq(schema.bullet.id, bulletId), eq(schema.bullet.userId, userId)) });
  const clean = text.trim().replace(/[.]+$/, "");
  if (!old || !clean || clean === old.text) return old;

  const factIds = [...old.factIds];
  {
    // The student typed the full revision, so record the claim itself as a stated fact.
    const [fact] = await db
      .insert(schema.fact)
      .values({
        userId,
        experienceId: old.experienceId,
        category: "experience",
        content: clean,
        source: "user_stated",
        sourceDetail: `bullet-edit:${old.id}`,
        verificationState: "confirmed",
        confirmedAt: new Date(),
      })
      .returning();
    factIds.push(fact.id);
  }

  const { score, checks } = scoreBullet(clean);
  const [row] = await db
    .insert(schema.bullet)
    .values({
      userId,
      experienceId: old.experienceId,
      text: clean,
      status: "active",
      favorite: old.favorite,
      factIds,
      score,
      scoreDetail: { checks, verified: true, unsupported: [] },
      generator: "user",
      editedFromId: old.id,
    })
    .returning();
  await db.update(schema.bullet).set({ status: "archived" }).where(eq(schema.bullet.id, old.id));
  await logEvent(userId, "bullet_edited", { from: old.id, to: row.id, before: old.text, after: clean, generator: old.generator });
  return row;
}

export async function setBulletFavorite(userId: string, bulletId: string, favorite: boolean) {
  await db.update(schema.bullet).set({ favorite }).where(and(eq(schema.bullet.id, bulletId), eq(schema.bullet.userId, userId)));
  if (favorite) await logEvent(userId, "bullet_favorited", { bulletId });
}

export async function archiveBullet(userId: string, bulletId: string) {
  await db.update(schema.bullet).set({ status: "archived" }).where(and(eq(schema.bullet.id, bulletId), eq(schema.bullet.userId, userId)));
}
