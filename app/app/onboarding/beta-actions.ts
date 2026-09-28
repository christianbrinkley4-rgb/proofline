"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { countableRoleLines, isProjectKind } from "@/components/onboarding/role-step";
import { requireSession } from "@/lib/auth";
import { addListFacts, saveEducation, saveRole, scoringReady } from "@/lib/facts/base";
import { OptionalContactEmail } from "@/lib/resume/header-contact";
import { updateProfile } from "@/lib/kb/profile";
import { ONBOARDING_STEPS, type OnboardingStep } from "./steps";

export type StepResult = { ok: true } | { ok: false; error: string };

const CONFIRM = "Tick the box to confirm this is true and in your own words.";
const Month = z.union([z.literal(""), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month.")]);

async function run(fn: (userId: string) => Promise<unknown>): Promise<StepResult> {
  const userId = (await requireSession()).user.id;
  try {
    await fn(userId);
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the form." };
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong. Try again." };
  }
}

export async function goToStepAction(step: OnboardingStep) {
  if (!ONBOARDING_STEPS.includes(step)) return;
  const userId = (await requireSession()).user.id;
  await updateProfile(userId, { onboardingStep: step });
}

const EntrySchema = z.object({
  entryId: z.string().trim().max(80).optional(),
  school: z.string().trim().min(1, "Add your school.").max(200),
  degree: z.string().trim().max(120),
  major: z.string().trim().max(160),
  gradDate: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick your graduation month (expected is fine)."),
  gpa: z.string().trim().regex(/^([0-4](\.\d{1,2})?)?$/, "GPA looks like 3.6, or leave it blank."),
  honors: z.string().trim().max(300),
  coursework: z.string().trim().max(600),
  details: z.array(z.string().trim().min(2).max(200)).max(12).default([]),
});

const EducationSchema = z.object({
  fullName: z.string().trim().min(1, "Add your name as it should appear on your resume.").max(120),
  phone: z.string().trim().max(40),
  city: z.string().trim().max(80),
  region: z.string().trim().max(80),
  contactEmail: OptionalContactEmail.default(""),
  linkedinUrl: z.string().trim().max(300).default(""),
  portfolioUrl: z.string().trim().max(300).default(""),
  entries: z.array(EntrySchema).min(1, "Add your school.").max(6, "Six schools is the limit. Remove one to add another."),
  confirmed: z.literal(true, CONFIRM),
});

export async function saveEducationStepAction(input: z.input<typeof EducationSchema>) {
  return run(async (userId) => {
    const v = EducationSchema.parse(input);
    await saveEducation(userId, v.entries);
    await updateProfile(userId, {
      fullName: v.fullName,
      phone: v.phone || null,
      city: v.city || null,
      region: v.region || null,
      contactEmail: v.contactEmail || null,
      linkedinUrl: v.linkedinUrl || null,
      portfolioUrl: v.portfolioUrl || null,
      onboardingStep: "experience",
    });
  });
}

const RoleSchema = z.object({
  kind: z.enum(["work", "internship", "leadership", "volunteer", "project", "research"]),
  org: z.string().trim().min(1, "Name the company, organization, or project.").max(160),
  title: z.string().trim().max(160),
  startDate: Month,
  endDate: Month,
  bullets: z.array(z.string().trim().max(400)).max(4),
  confirmed: z.literal(true, CONFIRM),
  /** Set only when a resume import already had one line for this role. */
  importedOneLine: z.boolean().optional(),
});

/** One role or project. Typed roles need 2 to 4 lines. An imported role that already had one line can stay at one. */
export async function saveRoleStepAction(input: z.input<typeof RoleSchema>) {
  return run(async (userId) => {
    const v = RoleSchema.parse(input);
    const bullets = countableRoleLines(v.bullets);
    const isProject = isProjectKind(v.kind);
    if (!isProject && !v.title) throw new Error("Add your title.");
    if (!isProject && v.importedOneLine && bullets.length < 1) throw new Error("Add at least one line about what you did.");
    if (!isProject && !v.importedOneLine && bullets.length < 2) throw new Error("Add at least two lines about what you did.");
    if (isProject && bullets.length < 1) throw new Error("Add at least one line about what you built or did.");
    if (!isProject && !v.startDate) throw new Error("Add when you started.");
    if (v.startDate && v.endDate && v.startDate > v.endDate) throw new Error("The end date is before the start date.");
    await saveRole(userId, { ...v, bullets });
  });
}

const ListsSchema = z.object({
  skills: z.array(z.string().trim().min(1).max(80)).max(40),
  licenses: z.array(z.string().trim().min(1).max(160)).max(20),
  confirmed: z.literal(true, CONFIRM),
});

export async function saveListsStepAction(input: z.input<typeof ListsSchema>) {
  return run(async (userId) => {
    const v = ListsSchema.parse(input);
    await addListFacts(userId, "skill", v.skills);
    await addListFacts(userId, "license", v.licenses);
    await updateProfile(userId, { onboardingStep: "logistics" });
  });
}

const LogisticsSchema = z.object({
  workAuthorization: z.enum(["", "us_citizen", "permanent_resident", "authorized", "needs_sponsorship"]),
  targetLocations: z.array(z.string().trim().min(1).max(80)).max(10),
  workModes: z.array(z.enum(["remote", "hybrid", "onsite"])),
  openToRelocate: z.enum(["", "yes", "no"]),
  availableFrom: Month,
});

/** Used only for knockouts. These are preferences, not resume claims, so they aren't facts. */
export async function saveLogisticsStepAction(input: z.input<typeof LogisticsSchema>) {
  return run(async (userId) => {
    const v = LogisticsSchema.parse(input);
    await updateProfile(userId, {
      workAuthorization: v.workAuthorization || null,
      targetLocations: v.targetLocations,
      workModes: v.workModes,
      openToRelocate: v.openToRelocate === "" ? null : v.openToRelocate === "yes",
      availableFrom: v.availableFrom || null,
      onboardingStep: "job",
    });
  });
}

/** Onboarding ends when the first job is in, or when they skip it. Refuses without the minimum. */
export async function finishOnboardingStepAction(): Promise<StepResult> {
  const userId = (await requireSession()).user.id;
  const readiness = await scoringReady(userId);
  if (!readiness.ready) {
    return { ok: false, error: readiness.hasEducation ? "Add one experience first so your fit can be scored." : "Add your education first so your fit can be scored." };
  }
  await updateProfile(userId, { onboardingCompletedAt: new Date(), onboardingStep: "done" });
  revalidatePath("/app", "layout");
  return { ok: true };
}
