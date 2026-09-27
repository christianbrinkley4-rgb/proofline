import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { extractSkills } from "@/lib/fit/skills";
import { hasUsableJobDescription } from "@/lib/jobs/description";
import { postingOverlap } from "@/lib/jobs/relevance";
import { requirementsOf } from "@/lib/jobs/store";
import { listFacts } from "@/lib/kb/facts";
import { listBullets } from "@/lib/resume/bullets/service";
import { verifyBullet } from "@/lib/resume/verify";
import { careerActions, type CareerMeasure } from "./plan";

export type CareerGoal = typeof schema.careerGoal.$inferSelect;
export type CareerCheckin = typeof schema.careerCheckin.$inferSelect;

async function loadBenchmark(jobId: string | null) {
  if (!jobId) return null;
  const job = await db.query.job.findFirst({ where: eq(schema.job.id, jobId) });
  return job && hasUsableJobDescription(job.description) ? job : null;
}

async function allowedBenchmark(userId: string, jobId: string | null) {
  if (!jobId) return null;
  const match = await db.query.jobMatch.findFirst({
    where: and(eq(schema.jobMatch.userId, userId), eq(schema.jobMatch.jobId, jobId), eq(schema.jobMatch.status, "saved")),
  });
  if (!match) throw new Error("Choose a job from your saved postings.");
  const job = await loadBenchmark(jobId);
  if (!job) throw new Error("Choose a posting with a full job description.");
  return job;
}

async function measureGoal(userId: string, goal: Pick<CareerGoal, "targetRole" | "benchmarkJobId">) {
  const [facts, bullets, job, candidate] = await Promise.all([
    listFacts(userId, { states: ["confirmed"] }),
    listBullets(userId),
    loadBenchmark(goal.benchmarkJobId),
    loadCandidate(userId),
  ]);
  const confirmed = new Map(facts.map((fact) => [fact.id, fact.content]));
  const active = bullets.filter((bullet) => bullet.status === "active" && bullet.factIds.length > 0 &&
    bullet.factIds.every((id) => confirmed.has(id)) &&
    verifyBullet(bullet.text, bullet.factIds.map((id) => confirmed.get(id)!)).ok);
  const fit = job ? scoreFit({
    title: job.title, location: job.location, mode: job.mode, level: job.level,
    requirements: requirementsOf(job),
  }, candidate) : null;
  const listed = new Set(fit?.details.requiredSkills.matched.flatMap((group) => group.split(" or ")) ?? []);
  const relevant = job ? active.filter((bullet) =>
    postingOverlap(bullet.text, job.description) > 0 || extractSkills(bullet.text).some((skill) => listed.has(skill))) : [];
  const matched = fit?.details.requiredSkills.matched ?? [];
  const missing = fit?.details.requiredSkills.missing ?? [];
  const measure: CareerMeasure = {
    confirmedFacts: facts.length,
    activeBullets: active.length,
    relevantBullets: relevant.length,
    matchedRequired: fit ? matched.length : null,
    totalRequired: fit ? matched.length + missing.length : null,
  };
  return { measure, job, matched, missing };
}

export async function careerDashboard(userId: string) {
  const goal = await db.query.careerGoal.findFirst({
    where: and(eq(schema.careerGoal.userId, userId), eq(schema.careerGoal.status, "active")),
    orderBy: [desc(schema.careerGoal.createdAt)],
  });
  const archived = await db.query.careerGoal.findMany({
    where: and(eq(schema.careerGoal.userId, userId), eq(schema.careerGoal.status, "archived")),
    orderBy: [desc(schema.careerGoal.createdAt)],
    limit: 10,
  });
  const savedMatches = await db.query.jobMatch.findMany({
    where: and(eq(schema.jobMatch.userId, userId), eq(schema.jobMatch.status, "saved")),
    orderBy: [desc(schema.jobMatch.updatedAt)],
    limit: 50,
  });
  const jobs = await Promise.all(savedMatches.map((match) => db.query.job.findFirst({ where: eq(schema.job.id, match.jobId) })));
  const options = jobs.filter((job): job is NonNullable<typeof job> => Boolean(job && hasUsableJobDescription(job.description)))
    .map((job) => ({ id: job.id, title: job.title, company: job.company }));
  if (!goal) return { goal: null, archived, options, current: null, checkins: [], actions: [], benchmark: null };
  const [{ measure, job, matched, missing }, checkins, completedRows] = await Promise.all([
    measureGoal(userId, goal),
    db.query.careerCheckin.findMany({
      where: and(eq(schema.careerCheckin.userId, userId), eq(schema.careerCheckin.goalId, goal.id)),
      orderBy: [desc(schema.careerCheckin.createdAt)],
      limit: 24,
    }),
    db.query.careerCheckin.findMany({
      where: and(
        eq(schema.careerCheckin.userId, userId),
        eq(schema.careerCheckin.goalId, goal.id),
        isNotNull(schema.careerCheckin.completedActionId),
      ),
      columns: { completedActionId: true },
    }),
  ]);
  const completedActionIds = new Set(completedRows.flatMap((entry) => entry.completedActionId ? [entry.completedActionId] : []));
  const tailoredResume = job ? await db.query.resume.findFirst({
    where: and(eq(schema.resume.userId, userId), eq(schema.resume.jobId, job.id)),
    columns: { id: true },
  }) : null;
  return {
    goal,
    archived,
    options,
    current: measure,
    checkins,
    benchmark: job ? { id: job.id, title: job.title, company: job.company } : null,
    actions: careerActions({ targetRole: goal.targetRole, measure, hasBenchmark: Boolean(job), missingRequired: missing, matchedRequired: matched, completedActionIds, benchmarkJobId: job?.id, hasTailoredResume: Boolean(tailoredResume) }),
  };
}

export async function setCareerGoal(userId: string, input: {
  targetRole: string; targetMonth: string | null; motivation: string | null; benchmarkJobId: string | null;
}) {
  await allowedBenchmark(userId, input.benchmarkJobId);
  const baseline = await measureGoal(userId, input);
  return db.transaction(async (tx) => {
    await tx.update(schema.careerGoal).set({ status: "archived" })
      .where(and(eq(schema.careerGoal.userId, userId), eq(schema.careerGoal.status, "active")));
    const [goal] = await tx.insert(schema.careerGoal).values({ userId, ...input }).returning();
    await tx.insert(schema.careerCheckin).values({ userId, goalId: goal.id, ...baseline.measure });
    return goal;
  });
}

export async function recordCareerCheckin(userId: string, goalId: string, reflection?: string | null, completedActionId?: string | null) {
  const note = reflection?.trim() || null;
  const goal = await db.query.careerGoal.findFirst({
    where: and(eq(schema.careerGoal.id, goalId), eq(schema.careerGoal.userId, userId), eq(schema.careerGoal.status, "active")),
  });
  if (!goal) throw new Error("Career goal not found.");
  const [{ measure, job, matched, missing }, checkins] = await Promise.all([
    measureGoal(userId, goal),
    db.query.careerCheckin.findMany({
      where: and(eq(schema.careerCheckin.userId, userId), eq(schema.careerCheckin.goalId, goalId)),
      orderBy: [desc(schema.careerCheckin.createdAt)],
    }),
  ]);
  const latest = checkins[0];
  if (completedActionId) {
    if (goal.targetRole !== "Explore career directions") throw new Error("Choose a step from your current exploration plan.");
    const completedActionIds = new Set(checkins.flatMap((entry) => entry.completedActionId ? [entry.completedActionId] : []));
    const available = careerActions({
      targetRole: goal.targetRole, measure, hasBenchmark: Boolean(job), missingRequired: missing,
      matchedRequired: matched, completedActionIds,
    });
    if (!available.some((action) => action.id === completedActionId)) {
      throw new Error("Choose a step from your current exploration plan.");
    }
  }
  const same = latest && (["confirmedFacts", "activeBullets", "relevantBullets", "matchedRequired", "totalRequired"] as const)
    .every((key) => latest[key] === measure[key]);
  if (same && !note && !completedActionId) return { ...latest, created: false as const };
  const [created] = await db.insert(schema.careerCheckin).values({ userId, goalId, ...measure, reflection: note, completedActionId: completedActionId || null }).returning();
  return { ...created, created: true as const };
}
