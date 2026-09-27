import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getExperience } from "@/lib/kb/experiences";
import { listFacts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { scoreBullet } from "@/lib/resume/bullet-score";
import { listBullets } from "@/lib/resume/bullets/service";
import { onetFollowupsForAccepted, onetTasksForTitle } from "@/lib/resume/onet-tasks";
import { ROLE_TASKS, tasksForExperience } from "@/lib/resume/role-tasks";
import { candidates, nearDuplicate, rankSuggestions } from "@/lib/resume/suggest";
import { verifyBullet } from "@/lib/resume/verify";
import { findVoiceIssues, findWeakOpener } from "@/lib/voice/rules";

export type BulletSuggestion = typeof schema.bulletSuggestion.$inferSelect;
export type AnswerInput = { answer: "yes" | "no"; reason?: "not_true" | "true_but_weak" | "wording"; slotValue?: string; editedText?: string };

export async function nextSuggestions(userId: string, experienceId: string, count = 5): Promise<BulletSuggestion[]> {
  const experience = await getExperience(userId, experienceId);
  if (!experience) throw new Error("Experience not found");
  const safeCount = Math.max(1, Math.min(10, Math.floor(count)));
  const allHistory = await db.query.bulletSuggestion.findMany({
    where: and(eq(schema.bulletSuggestion.userId, userId), eq(schema.bulletSuggestion.experienceId, experienceId)),
    orderBy: [desc(schema.bulletSuggestion.batch)],
  });
  const [facts, profile, bullets] = await Promise.all([
    listFacts(userId, { experienceId, states: ["confirmed"] }),
    getProfile(userId),
    listBullets(userId, [experienceId]),
  ]);
  const baseOnet = onetTasksForTitle(experience.title, 180);
  const acceptedIds = new Set(allHistory.filter((item) => item.status === "accepted").map((item) => item.taskId).filter((id): id is string => Boolean(id)));
  const tasks = [...tasksForExperience(experience), ...baseOnet, ...onetFollowupsForAccepted(baseOnet, acceptedIds)];
  const validTaskIds = new Set(tasks.map((task) => task.id));
  const confirmedFactIds = new Set(facts.map((fact) => fact.id));
  const excluded = new Set(allHistory.filter((item) => item.status === "rejected" && item.reason === "not_true").map((item) => item.taskId));
  for (const id of [...excluded]) for (const related of ROLE_TASKS.find((task) => task.id === id)?.related ?? []) excluded.add(related);
  const pending = allHistory.filter((item) => item.status === "pending" &&
    (item.taskId ? validTaskIds.has(item.taskId) && !excluded.has(item.taskId) : item.sourceFactIds.every((id) => confirmedFactIds.has(id))))
    .filter((item) => !bullets.some((bullet) => bullet.status === "active" && nearDuplicate(bullet.text, item.text)))
    .sort((a, b) => a.batch - b.batch || a.createdAt.getTime() - b.createdAt.getTime())
    .filter((item, index, items) => !items.slice(0, index).some((earlier) => nearDuplicate(earlier.text, item.text)))
    .slice(0, safeCount);
  if (pending.length >= safeCount) return pending;
  const history = allHistory;
  const offered = candidates({ ...experience, targetRoles: profile?.targetRoles ?? [] }, facts, tasks);
  const ranked = rankSuggestions(offered, history, [...ROLE_TASKS, ...tasks], bullets.map((bullet) => bullet.text));
  const needed = ranked.slice(0, safeCount - pending.length);
  if (!needed.length) return pending;
  const batch = Math.max(0, ...history.map((item) => item.batch)) + 1;
  const created = await db.insert(schema.bulletSuggestion).values(needed.map((item) => ({
    userId,
    experienceId,
    text: item.text,
    taskId: item.taskId,
    kind: item.kind,
    skills: item.skills,
    sourceFactIds: item.sourceFactIds,
    slot: item.slot,
    batch,
    generator: item.taskId?.startsWith("onet:") ? "onet-31.0" : "offline",
    promptVersion: null,
  }))).returning();
  return [...pending, ...created];
}

export async function answerSuggestion(userId: string, id: string, input: AnswerInput) {
  const item = await db.query.bulletSuggestion.findFirst({ where: and(eq(schema.bulletSuggestion.id, id), eq(schema.bulletSuggestion.userId, userId)) });
  if (!item || item.status !== "pending") throw new Error("Suggestion is no longer available");
  if (input.answer === "no") {
    if (!input.reason) throw new Error("Choose why this one did not fit");
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(schema.bulletSuggestion)
        .set({ status: "rejected", reason: input.reason, answeredAt: new Date() })
        .where(and(eq(schema.bulletSuggestion.id, id), eq(schema.bulletSuggestion.userId, userId), eq(schema.bulletSuggestion.status, "pending"))).returning();
      if (!updated) throw new Error("Suggestion already answered");
      await tx.insert(schema.agentEvent).values({ userId, type: "suggestion_answered", data: { suggestionId: id, experienceId: item.experienceId, answer: "no", reason: input.reason, taskId: item.taskId } });
    });
    return { status: "rejected" as const, bulletId: null };
  }

  const slotValue = input.slotValue?.trim() ?? "";
  if (item.slot && (!slotValue || slotValue.length > 40 || /[\[\]\n\r]/.test(slotValue) || (item.slot === "how many?" && !/\d/.test(slotValue)))) {
    throw new Error(item.slot === "how many?" ? "Enter a real number you can explain" : "Fill in what happened in your own words");
  }
  const suggested = item.slot ? item.text.replace(`[${item.slot}]`, slotValue) : item.text;
  const text = (input.editedText?.trim().replace(item.slot ? `[${item.slot}]` : "\u0000", slotValue) || suggested).replace(/[.\s]+$/, "");
  if (!text || text.length > 300 || /\[[^\]]+\]/.test(text)) throw new Error("Finish the bullet before saving it");
  if (findVoiceIssues(text).length || findWeakOpener(text)) throw new Error("Use a clear action verb and plain wording");

  // An unchanged rewording can cite the already-confirmed source fact instead of
  // adding a duplicate fact to the person's profile. Edited or task-based cards
  // are new claims, explicitly confirmed by this yes.
  const sourceFacts = item.kind === "reframe" && item.sourceFactIds.length
    ? (await listFacts(userId, { experienceId: item.experienceId, states: ["confirmed"] }))
      .filter((fact) => item.sourceFactIds.includes(fact.id))
    : [];
  if (item.kind === "reframe" && text === suggested && item.sourceFactIds.length !== sourceFacts.length) {
    throw new Error("This suggestion is out of date. Reopen the bullet bank.");
  }
  const reuseSources = item.kind === "reframe" && text === suggested && sourceFacts.length > 0;
  const check = verifyBullet(text, reuseSources ? sourceFacts.map((fact) => fact.content) : [text]);
  if (!check.ok) throw new Error("Could not verify the bullet");
  const { score, checks } = scoreBullet(text);
  return db.transaction(async (tx) => {
    const [claimed] = await tx.update(schema.bulletSuggestion)
      .set({ status: "accepted", answeredAt: new Date() })
      .where(and(eq(schema.bulletSuggestion.id, id), eq(schema.bulletSuggestion.userId, userId), eq(schema.bulletSuggestion.status, "pending"))).returning();
    if (!claimed) throw new Error("Suggestion already answered");
    let factIds = reuseSources ? item.sourceFactIds : [];
    let addedFactId: string | null = null;
    if (!reuseSources) {
      const [fact] = await tx.insert(schema.fact).values({
        userId, category: "experience", content: text, experienceId: item.experienceId,
        source: "user_stated", sourceDetail: `suggestion:${id}`,
        verificationState: "confirmed", confirmedAt: new Date(),
      }).returning();
      factIds = [fact.id];
      addedFactId = fact.id;
    }
    const [bullet] = await tx.insert(schema.bullet).values({
      userId, experienceId: item.experienceId, text, status: "active", factIds,
      score, scoreDetail: { checks, verified: true, unsupported: [] },
      generator: input.editedText?.trim() ? "user" : item.generator,
      promptVersion: item.promptVersion,
    }).returning();
    await tx.insert(schema.agentEvent).values([
      ...(addedFactId ? [{ userId, type: "fact_confirmed", data: { factId: addedFactId, source: "user_stated" } }] : []),
      { userId, type: "suggestion_answered", data: { suggestionId: id, experienceId: item.experienceId, answer: "yes", taskId: item.taskId, bulletId: bullet.id } },
      ...(input.editedText?.trim() && text !== suggested
        ? [{ userId, type: "bullet_edited", data: { before: suggested, after: text, from: id, to: bullet.id, generator: item.generator } }]
        : []),
    ]);
    return { status: "accepted" as const, bulletId: bullet.id };
  });
}

export async function bankStats(userId: string) {
  const bullets = await listBullets(userId);
  return { active: bullets.filter((bullet) => bullet.status === "active").length };
}
