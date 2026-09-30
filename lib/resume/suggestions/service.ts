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

export type BulletSuggestion = typeof schema.bulletSuggestion.$inferSelect & { xyzDefaults?: RecallParts };
import { type RecallXyz, type RecallParts } from "@/lib/resume/recall-xyz";

import { recallParts, RECALL_REVIEW_VERSION, reviewRecallWording, validateRecallWording, type RecallReviewMode } from "@/lib/review/recall";

import { discoverRecall, discoveryTasks } from "@/lib/resume/recall-discovery";

export type AnswerInput = { reviewId?: string; reviewedText?: string; confirmed?: boolean; xyz?: RecallXyz; answer: "yes" | "no"; reason?: "not_true" | "true_but_weak" | "wording"; slotValue?: string; editedText?: string };

export async function nextSuggestions(userId: string, experienceId: string, count = 5, mode: "bank" | "recall" = "bank"): Promise<BulletSuggestion[]> {
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
  if (mode === "recall") {
    const roleFacts = facts.filter((fact) => ["experience", "project", "metric", "leadership"].includes(fact.category) &&
      !["org", "title", "location", "dates"].includes(String(fact.data?.field ?? "")));
    const knownWork = [
      ...roleFacts.map((fact) => fact.content),
      ...roleFacts.flatMap((fact) => {
        const raw = fact.data?.recallXyz;
        return raw && typeof raw === "object" && typeof (raw as Record<string, unknown>).action === "string" ? [String((raw as Record<string, unknown>).action)] : [];
      }),
      ...bullets.filter((bullet) => bullet.status === "active").map((bullet) => bullet.text),
    ];
    const relatedTasks = discoveryTasks(experience, roleFacts.map((fact) => fact.content));
    // Old pending fact follow-ups remain in history but are never offered by discovery.
    const ranked = discoverRecall(experience, relatedTasks, allHistory, knownWork).slice(0, safeCount);
    const batch = Math.max(0, ...allHistory.map((item) => item.batch)) + 1;
    const out: BulletSuggestion[] = [];
    for (const item of ranked) {
      const pending = allHistory.find((old) => old.status === "pending" && old.promptVersion?.startsWith("role-recall.") && old.taskId === item.taskId && old.text === item.text);
      if (pending) { out.push(pending); continue; }
      const [created] = await db.insert(schema.bulletSuggestion).values({ userId, experienceId, text: item.text, taskId: item.taskId, kind: item.kind, skills: item.skills, sourceFactIds: item.sourceFactIds, slot: item.slot, batch, generator: item.taskId?.startsWith("onet:") ? "onet-31.0" : "offline", promptVersion: "role-recall.v3" }).returning();
      out.push(created);
    }
    return out;
  }
  // The older bank keeps its existing reframe and follow-up behavior.
  const baseOnet = onetTasksForTitle(experience.title, 180);
  const acceptedIds = new Set(allHistory.filter((item) => item.status === "accepted").map((item) => item.taskId).filter((id): id is string => Boolean(id)));
  const tasks = [...tasksForExperience(experience), ...baseOnet, ...onetFollowupsForAccepted(baseOnet, acceptedIds)];
  const validTaskIds = new Set(tasks.map((task) => task.id));
  const confirmedFactIds = new Set(facts.map((fact) => fact.id));
  const excluded = new Set(allHistory.filter((item) => item.status === "rejected" && item.reason === "not_true").map((item) => item.taskId));
  for (const id of [...excluded]) for (const related of ROLE_TASKS.find((task) => task.id === id)?.related ?? []) excluded.add(related);
  const pending = allHistory.filter((item) => item.status === "pending" && !item.promptVersion?.startsWith("role-recall.") &&
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

function sameRecallParts(stored: unknown, parts: RecallParts): boolean {
  if (!stored || typeof stored !== "object") return false;
  return (["action", "measure", "method", "result"] as const).every((key) => (stored as Record<string, unknown>)[key] === parts[key]);
}

/** Review never creates evidence; the finished line still needs explicit confirmation. */
export async function reviewSuggestion(userId: string, id: string, input: { editedText: string; xyz: RecallXyz; mode?: RecallReviewMode }) {
  const item = await db.query.bulletSuggestion.findFirst({ where: and(eq(schema.bulletSuggestion.id, id), eq(schema.bulletSuggestion.userId, userId)) });
  if (!item || item.status !== "pending" || !item.promptVersion?.startsWith("role-recall.") || item.taskId?.startsWith("fact:")) return { ok: false as const, error: "This question is out of date. Load the next question." };
  const parts = recallParts(input.editedText, { ...input.xyz, result: input.xyz.result ?? "" });
  if (item.slot === "what changed?" && !parts.result) return { ok: false as const, error: "Fill in what changed, or skip this result question" };
  const cached = await db.query.agentEvent.findMany({ where: and(eq(schema.agentEvent.userId, userId), eq(schema.agentEvent.type, "recall_wording_reviewed")), orderBy: [desc(schema.agentEvent.createdAt)], limit: 20 });
  const expectedMethod = input.mode === "rules" || !process.env.PROOFLINE_REVIEW_KEY?.trim() ? "rules" : "model";
  const previous = cached.find((event) => event.data.method === expectedMethod && event.createdAt.getTime() > Date.now() - 30 * 60_000 && event.data.version === RECALL_REVIEW_VERSION && event.data.suggestionId === id && sameRecallParts(event.data.parts, parts));
  if (previous) return { ok: true as const, reviewId: previous.id, text: String(previous.data.text), method: previous.data.method as "model" | "rules", message: String(previous.data.message) };
  const result = await reviewRecallWording(userId, parts, input.mode);
  if (!result.ok) return result;
  const [event] = await db.insert(schema.agentEvent).values({ userId, type: "recall_wording_reviewed", data: { suggestionId: id, parts, text: result.text, method: result.method, message: result.message, version: RECALL_REVIEW_VERSION } }).returning();
  return { ...result, reviewId: event.id };
}

export async function answerSuggestion(userId: string, id: string, input: AnswerInput) {
  const item = await db.query.bulletSuggestion.findFirst({ where: and(eq(schema.bulletSuggestion.id, id), eq(schema.bulletSuggestion.userId, userId)) });
  if (!item) throw new Error("This suggestion expired. Reopen your bullet bank.");
  // Two fast taps or another open tab may submit the same card twice. The first
  // answer wins; a repeat must not create another fact or become a server error.
  if (item.status !== "pending") return { status: "already_answered" as const, bulletId: null };
  if (input.answer === "no") {
    if (!input.reason) throw new Error("Choose why this one did not fit");
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(schema.bulletSuggestion)
        .set({ status: "rejected", reason: input.reason, answeredAt: new Date() })
        .where(and(eq(schema.bulletSuggestion.id, id), eq(schema.bulletSuggestion.userId, userId), eq(schema.bulletSuggestion.status, "pending"))).returning();
      if (!updated) return;
      await tx.insert(schema.agentEvent).values({ userId, type: "suggestion_answered", data: { suggestionId: id, experienceId: item.experienceId, answer: "no", reason: input.reason, taskId: item.taskId } });
    });
    return { status: "rejected" as const, bulletId: null };
  }

  const slotValue = input.slotValue?.trim() ?? "";
  const xyzRecall = item.promptVersion?.startsWith("role-recall.");
  if (xyzRecall && item.taskId?.startsWith("fact:")) throw new Error("This old question repeats saved work. Load the next question for a new task.");
  if (xyzRecall && input.confirmed !== true) throw new Error("Confirm that this line is true and in your own words");
  if (xyzRecall && !input.xyz) throw new Error("Describe what you did before saving");
  if (!xyzRecall && item.slot && (!slotValue || slotValue.length > 40 || /[\[\]\n\r]/.test(slotValue) || (item.slot === "how many?" && !/\d/.test(slotValue)))) {
    throw new Error(item.slot === "how many?" ? "Enter a real number you can explain" : "Fill in what happened in your own words");
  }
  const suggested = item.slot ? item.text.replace(`[${item.slot}]`, slotValue) : item.text;
  let text = (input.editedText?.trim().replace(item.slot ? `[${item.slot}]` : "\u0000", slotValue) || suggested).replace(/[.\s]+$/, "");
  if (xyzRecall) {
    const parts = recallParts(input.editedText ?? "", { ...input.xyz!, result: input.xyz?.result ?? "" });
    const review = input.reviewId ? await db.query.agentEvent.findFirst({ where: and(eq(schema.agentEvent.id, input.reviewId), eq(schema.agentEvent.userId, userId), eq(schema.agentEvent.type, "recall_wording_reviewed")) }) : null;
    if (!review || review.data.version !== RECALL_REVIEW_VERSION || review.data.suggestionId !== id || review.createdAt.getTime() <= Date.now() - 30 * 60_000 || !sameRecallParts(review.data.parts, parts)) throw new Error("Review the finished wording again before saving. The answers or wording review changed.");
    text = validateRecallWording(parts, String(review.data.text));
  }
  if (xyzRecall && item.slot === "what changed?" && !input.xyz?.result?.trim()) throw new Error("Fill in what changed, or skip this result question");
  if (xyzRecall && input.reviewedText !== text) throw new Error("The bullet preview changed. Review the finished wording again before saving.");
  if (!text || text.length > 300 || /\[[^\]]+\]/.test(text)) throw new Error("Finish the bullet before saving it");
  if (findVoiceIssues(text).length || findWeakOpener(text)) throw new Error("Use a clear action verb and plain wording");

  // An unchanged rewording can cite the already-confirmed source fact instead of
  // adding a duplicate fact to the person's profile. Edited or task-based cards
  // are new claims, explicitly confirmed by this yes.
  const sourceFacts = item.kind === "reframe" && item.sourceFactIds.length
    ? (await listFacts(userId, { experienceId: item.experienceId, states: ["confirmed"] }))
      .filter((fact) => item.sourceFactIds.includes(fact.id))
    : [];
  if (item.kind === "reframe" && item.sourceFactIds.length !== sourceFacts.length) {
    throw new Error("This suggestion is out of date. Reopen the bullet bank.");
  }
  const reuseSources = item.kind === "reframe" && !item.taskId && text === suggested && sourceFacts.length > 0;
  const check = verifyBullet(text, reuseSources ? sourceFacts.map((fact) => fact.content) : [text]);
  if (!check.ok) throw new Error("Could not verify the bullet");
  const { score, checks } = scoreBullet(text);
  return db.transaction(async (tx) => {
    const [claimed] = await tx.update(schema.bulletSuggestion)
      .set({ status: "accepted", answeredAt: new Date() })
      .where(and(eq(schema.bulletSuggestion.id, id), eq(schema.bulletSuggestion.userId, userId), eq(schema.bulletSuggestion.status, "pending"))).returning();
    if (!claimed) return { status: "already_answered" as const, bulletId: null };
    let factIds = reuseSources ? item.sourceFactIds : [];
    let addedFactId: string | null = null;
    if (!reuseSources) {
      const [fact] = await tx.insert(schema.fact).values({
        userId, category: "experience", content: text, experienceId: item.experienceId,
        source: "user_stated", sourceDetail: `suggestion:${id}`,
        data: xyzRecall ? { recallXyz: { action: input.editedText, ...input.xyz } } : undefined,
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
