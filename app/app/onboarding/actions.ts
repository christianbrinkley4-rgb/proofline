"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logEvent } from "@/lib/agent/events";
import { notesToStatements, probeExperience } from "@/lib/agent/probe";
import { requireSession } from "@/lib/auth";
import { addFact, confirmFact, listFacts, rejectFact, reviseFact } from "@/lib/kb/facts";
import { createExperience } from "@/lib/kb/experiences";
import { updateProfile } from "@/lib/kb/profile";
import { answerQuestion, askQuestion, dismissQuestion } from "@/lib/kb/questions";
import { ONBOARDING_STEPS, type OnboardingStep } from "./steps";

async function userId() {
  return (await requireSession()).user.id;
}

function refresh() {
  revalidatePath("/app", "layout");
}

export async function saveStepAction(step: OnboardingStep) {
  if (!ONBOARDING_STEPS.includes(step)) return;
  await updateProfile(await userId(), { onboardingStep: step });
}

// ─── Fact confirmation ────────────────────────────────────────────────────────

export async function confirmFactAction(factId: string) {
  await confirmFact(await userId(), factId);
  refresh();
}

export async function rejectFactAction(factId: string) {
  await rejectFact(await userId(), factId, "rejected during review");
  refresh();
}

export async function reviseFactAction(factId: string, content: string) {
  const text = content.trim();
  if (!text) return;
  await reviseFact(await userId(), factId, { content: text, source: "user_stated" });
  refresh();
}

export async function confirmFactsAction(factIds: string[]) {
  const id = await userId();
  for (const factId of factIds) await confirmFact(id, factId);
  refresh();
}

// ─── Basics and goals ─────────────────────────────────────────────────────────

const BasicsSchema = z.object({
  fullName: z.string().trim().min(1, "Add your name"),
  phone: z.string().trim(),
  city: z.string().trim(),
  region: z.string().trim(),
  linkedinUrl: z.string().trim(),
  portfolioUrl: z.string().trim(),
  school: z.string().trim(),
  degree: z.string().trim(),
  major: z.string().trim(),
  minor: z.string().trim(),
  gradDate: z.string().trim().regex(/^(\d{4}(-\d{2})?)?$/, "Use a date like 2028-05"),
  gpa: z.string().trim().regex(/^([0-4](\.\d{1,2})?)?$/, "GPA looks like 3.6"),
});

export type BasicsInput = z.infer<typeof BasicsSchema>;

export async function saveBasicsAction(input: BasicsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = BasicsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const id = await userId();
  await updateProfile(id, {
    fullName: v.fullName,
    phone: v.phone || null,
    city: v.city || null,
    region: v.region || null,
    linkedinUrl: v.linkedinUrl || null,
    portfolioUrl: v.portfolioUrl || null,
    school: v.school || null,
    degree: v.degree || null,
    major: v.major || null,
    minor: v.minor || null,
    gradDate: v.gradDate || null,
    gpa: v.gpa ? Number(v.gpa) : null,
    onboardingStep: "goals",
  });
  refresh();
  return { ok: true };
}

const GoalsSchema = z.object({
  targetRoles: z.array(z.string().trim().min(1)).min(1, "Pick at least one kind of role"),
  targetTerm: z.string().trim(),
  targetLocations: z.array(z.string().trim().min(1)),
  workModes: z.array(z.enum(["remote", "hybrid", "onsite"])),
  industries: z.array(z.string().trim().min(1)),
  payFloor: z.string().trim().regex(/^\d*$/),
  workAuthorization: z.string().trim(),
  dealBreakers: z.array(z.string().trim().min(1)),
});

export type GoalsInput = z.infer<typeof GoalsSchema>;

export async function saveGoalsAction(input: GoalsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = GoalsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const id = await userId();
  await updateProfile(id, {
    targetRoles: v.targetRoles,
    targetTerm: v.targetTerm || null,
    targetLocations: v.targetLocations,
    workModes: v.workModes,
    industries: v.industries,
    payFloor: v.payFloor ? Number(v.payFloor) : null,
    workAuthorization: v.workAuthorization || null,
    dealBreakers: v.dealBreakers,
    onboardingStep: "experience",
  });
  refresh();
  return { ok: true };
}

// ─── Experiences, told in the student's own words ─────────────────────────────

const ExperienceSchema = z.object({
  kind: z.enum(["work", "internship", "leadership", "project", "volunteer", "research"]),
  org: z.string().trim().min(1, "Where was this?"),
  title: z.string().trim(),
  location: z.string().trim(),
  startDate: z.string().trim().regex(/^(\d{4}-\d{2})?$/),
  endDate: z.string().trim().regex(/^(\d{4}-\d{2})?$/),
  notes: z.string().trim().min(10, "Tell your agent a little more about it"),
});

export type ExperienceFormInput = z.infer<typeof ExperienceSchema>;

export async function addExperienceAction(
  input: ExperienceFormInput,
): Promise<{ ok: true; experienceId: string; questions: number } | { ok: false; error: string }> {
  const parsed = ExperienceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const id = await userId();

  const experience = await createExperience(id, {
    kind: v.kind,
    org: v.org,
    title: v.title || null,
    location: v.location || null,
    startDate: v.startDate || null,
    endDate: v.endDate || null,
    rawNotes: v.notes,
  });

  // The student said it, so each statement is a confirmed fact in their own words.
  for (const statement of notesToStatements(v.notes)) {
    await addFact(id, { category: "experience", content: statement, experienceId: experience.id, source: "user_stated", sourceDetail: "onboarding" });
  }

  const questions = probeExperience({ org: v.org, title: v.title, notes: v.notes });
  for (const q of questions) await askQuestion(id, { ...q, experienceId: experience.id });

  refresh();
  return { ok: true, experienceId: experience.id, questions: questions.length };
}

export async function answerQuestionAction(questionId: string, answer: string) {
  const result = await answerQuestion(await userId(), questionId, answer);
  refresh();
  return result?.question.status ?? null;
}

export async function skipQuestionAction(questionId: string) {
  await dismissQuestion(await userId(), questionId);
  refresh();
}

// ─── Skills and finish ────────────────────────────────────────────────────────

export async function saveSkillsAction(skills: string[]) {
  const id = await userId();
  const current = await listFacts(id, { categories: ["skill", "tool"] });
  const known = new Map(current.map((f) => [f.content.toLowerCase(), f]));
  const wanted = new Set(skills.map((s) => s.trim()).filter(Boolean));

  for (const skill of wanted) {
    const existing = known.get(skill.toLowerCase());
    if (existing) {
      if (existing.verificationState !== "confirmed") await confirmFact(id, existing.id);
    } else {
      await addFact(id, { category: "skill", content: skill, source: "user_stated", sourceDetail: "onboarding" });
    }
  }
  // Parsed skills the student removed are rejected, so they never come back.
  for (const fact of current) {
    if (fact.verificationState !== "confirmed" && ![...wanted].some((s) => s.toLowerCase() === fact.content.toLowerCase())) {
      await rejectFact(id, fact.id, "removed during onboarding");
    }
  }
  await updateProfile(id, { onboardingStep: "done" });
  refresh();
}

export async function finishOnboardingAction() {
  const id = await userId();
  await updateProfile(id, { onboardingCompletedAt: new Date(), onboardingStep: "done" });
  await logEvent(id, "preference_learned", { source: "onboarding_completed" });
  refresh();
}
