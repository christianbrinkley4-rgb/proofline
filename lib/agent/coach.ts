import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { FitReport } from "@/lib/fit/engine";
import { skillGaps } from "@/lib/fit/gaps";
import { listMatches } from "@/lib/jobs/store";
import { listExperiences } from "@/lib/kb/experiences";
import { factCounts, listFacts } from "@/lib/kb/facts";
import { listBullets } from "@/lib/resume/bullets/service";
import { verifyBullet } from "@/lib/resume/verify";
import { letterStatus, type LetterStatus } from "@/lib/packet/cover-letter";
import { readLetter } from "@/lib/packet/service";
import { listApplications, type Application } from "@/lib/tracker/service";
import { declinedSkills } from "./gap-store";
import { storyReady } from "./story-ready";

export { storyReady };

/**
 * The coach: the best possible resume for each job, one step at a time.
 *
 *   1. Your resume: confirmed facts and a general one-page resume
 *   2. Paste a job: a link from anywhere, or the posting itself
 *   3. Tailored resume: the one best version for the job
 *   4. Close the gaps: answer what the posting asks for, then rebuild
 *
 * Cover letters, tracking, and interview prep follow once the resume is right.
 * Pure rules over the student's own state, so Today, the job page, and chat agree.
 */

export const JOURNEY = [
  { id: "resume", label: "Your resume" },
  { id: "job", label: "Paste a job" },
  { id: "tailor", label: "Tailored resume" },
  { id: "strengthen", label: "Close gaps" },
] as const;

export type JourneyStepId = (typeof JOURNEY)[number]["id"];
export type StepState = "done" | "current" | "upcoming";

/** Stages after the student has applied. */
const SENT = new Set(["applied", "assessment", "interview", "offer", "rejected"]);

/** The one job the coach is working on with the student. */
export type FocusJob = {
  jobId: string;
  company: string;
  title: string;
  /** Tracker stage, or null when the job is saved but not tracked. */
  stage: string | null;
  /** Resume versions built for this job. */
  resumes: number;
  letter: LetterStatus;
  /** Skills the posting asks for that the student hasn't answered or ruled out. */
  openGaps: number;
  /** New confirmed facts since the resumes were built. */
  stale: boolean;
};

export type JourneyInput = {
  confirmedFacts: number;
  pendingFacts: number;
  usableBullets: number;
  experiences: number;
  /** A general (not job-specific) resume exists. */
  baseResume: boolean;
  focus: FocusJob | null;
};

export type CoachAction = {
  /** What to do, as a short imperative. */
  title: string;
  /** Why, in a sentence. */
  detail: string;
  href: string;
  cta: string;
};

export type Journey = {
  steps: Array<{ id: JourneyStepId; label: string; state: StepState }>;
  /** The step in progress, or "done" when the focus job's resume is as strong as the evidence allows. */
  current: JourneyStepId | "done";
  action: CoachAction;
  focus: FocusJob | null;
  /** 1-based position of the current step, for "Step 3 of 4". */
  position: number;
};

/** Where the paste box lives. */
export const PASTE_HREF = "/app#paste";

function stepDone(id: JourneyStepId, input: JourneyInput): boolean {
  const f = input.focus;
  switch (id) {
    case "resume":
      // A general resume is the start, but someone who went straight to a job needn't go back for one.
      return storyReady(input) && (input.baseResume || Boolean(f));
    case "job":
      return Boolean(f);
    case "tailor":
      return Boolean(f && f.resumes > 0);
    case "strengthen":
      return Boolean(f && f.openGaps === 0 && !f.stale);
  }
}

function actionFor(id: JourneyStepId | "done", input: JourneyInput): CoachAction {
  const f = input.focus;
  switch (id) {
    case "resume":
      if (input.pendingFacts > 0 && input.confirmedFacts === 0) {
        return {
          title: "Check what I found about you",
          detail: `${input.pendingFacts} ${input.pendingFacts === 1 ? "fact is" : "facts are"} waiting for a yes. Only confirmed facts go on your resume, so this comes first.`,
          href: "/app/profile",
          cta: "Review facts",
        };
      }
      if (!storyReady(input)) {
        return {
          title: "Tell me about one thing you've done",
          detail: "A job, a class project, a club, volunteering. Upload a resume or talk it out, and I'll turn it into facts you confirm.",
          href: "/app/profile#start",
          cta: "Add your story",
        };
      }
      if (input.usableBullets === 0) {
        return {
          title: "Turn an example into a resume bullet",
          detail: "Your confirmed facts are a start. Review or write one bullet on your profile that you can explain in an interview, then build the resume.",
          href: "/app/profile",
          cta: "Write a bullet",
        };
      }      return {
        title: "Build your resume",
        detail: "One page from your confirmed facts, checked line by line. It's the base every tailored version starts from.",
        href: "/app/resumes/new",
        cta: "Build my resume",
      };
    case "job":
      return {
        title: "Paste a job you want",
        detail: "A link from LinkedIn, Indeed, Handshake, or any company site, or the description itself. I'll check the knockouts, score your fit, and build one tailored version of your resume for it.",
        href: PASTE_HREF,
        cta: "Paste a job",
      };
    case "tailor":
      return {
        title: `Build your tailored resume for ${f!.company}`,
        detail: "Experience-first, skills-first, and keyword-matched, each one page and built only from your confirmed facts. I'll tell you which one fits best.",
        href: `/app/jobs/${f!.jobId}?build=1#resumes`,
        cta: "Build them",
      };
    case "strengthen":
      return f!.openGaps === 0
        ? {
            title: "Rebuild with what you just added",
            detail: "You've added evidence since these resumes were built. Rebuild them so your new answers make it onto the page.",
            href: `/app/jobs/${f!.jobId}#resumes`,
            cta: "Rebuild resumes",
          }
        : {
            title: `Make your ${f!.company} resume stronger`,
            detail: `${f!.openGaps} ${f!.openGaps === 1 ? "thing the posting asks for isn't" : "things the posting asks for aren't"} on your resume yet. Tell me where you've done ${f!.openGaps === 1 ? "it" : "them"}, or mark ${f!.openGaps === 1 ? "it" : "them"} as not yet.`,
            href: `/app/jobs/${f!.jobId}#strengthen`,
            cta: "Close the gaps",
          };
    case "done":
      return {
        title: "Paste your next job",
        detail: f
          ? `Your ${f.company} resume is as strong as your evidence allows. Download it, write the cover letter when you're ready, or line up the next role.`
          : "Paste a job to get your fit and one tailored resume.",
        href: PASTE_HREF,
        cta: "Paste a job",
      };
  }
}

export function buildJourney(input: JourneyInput): Journey {
  const firstOpen = JOURNEY.find((s) => !stepDone(s.id, input));
  const current: Journey["current"] = firstOpen?.id ?? "done";
  const currentIndex = firstOpen ? JOURNEY.findIndex((s) => s.id === firstOpen.id) : JOURNEY.length;
  return {
    steps: JOURNEY.map((s, i) => ({ id: s.id, label: s.label, state: i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming" })),
    current,
    action: actionFor(current, input),
    focus: input.focus,
    position: Math.min(currentIndex + 1, JOURNEY.length),
  };
}

/** Candidate jobs to focus on, as loaded from the tracker and saved matches. */
export type FocusCandidate = FocusJob & { updatedAt: Date };

/**
 * The job to work on: an unsent one, newest first, so pasting a job makes it the
 * focus. When everything is sent, the newest sent one.
 */
export function pickFocus(candidates: FocusCandidate[]): FocusJob | null {
  const open = candidates.filter((c) => !c.stage || !SENT.has(c.stage));
  const pool = open.length ? open : candidates.filter((c) => c.stage !== "rejected");
  const best = [...pool].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  if (!best) return null;
  const { jobId, company, title, stage, resumes, letter, openGaps, stale } = best;
  return { jobId, company, title, stage, resumes, letter, openGaps, stale };
}

/** Packet order: attach a resume, write the letter and the why, then apply and track. */
export type PacketStep = "resume" | "letter" | "track" | "done";

export function packetStep(input: { resumes: number; attached: boolean; letter: LetterStatus; stage: string | null }): PacketStep {
  if (input.stage && SENT.has(input.stage)) return "done";
  if (input.resumes === 0) return "resume";
  if (input.letter !== "ready") return "letter";
  return "track";
}

export function isSent(stage: string | null): boolean {
  return Boolean(stage && SENT.has(stage));
}

/** When the newest confirmed fact landed, to tell whether a resume predates new evidence. */
export async function latestFactAt(userId: string): Promise<Date | null> {
  const row = await db.query.fact.findFirst({
    where: and(eq(schema.fact.userId, userId), eq(schema.fact.verificationState, "confirmed")),
    orderBy: [desc(schema.fact.createdAt)],
    columns: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

/** Every saved or tracked job with how far its resume and packet have come. */
export async function loadJobProgress(userId: string, applications?: Application[]): Promise<FocusCandidate[]> {
  const [apps, saved, declined, factAt] = await Promise.all([
    applications ?? listApplications(userId),
    listMatches(userId, ["saved"], 20),
    declinedSkills(userId),
    latestFactAt(userId),
  ]);
  const byJob = new Map<string, FocusCandidate>();
  const fitByJob = new Map<string, FitReport | null>();
  for (const { job, match } of saved) {
    byJob.set(job.id, { jobId: job.id, company: job.company, title: job.title, stage: null, resumes: 0, letter: "none", openGaps: 0, stale: false, updatedAt: match.updatedAt });
    fitByJob.set(job.id, (match.fit as FitReport | null) ?? null);
  }
  for (const a of apps) {
    if (!a.jobId) continue;
    const prior = byJob.get(a.jobId);
    byJob.set(a.jobId, { ...(prior ?? { openGaps: 0, stale: false, letter: "none" as const }), jobId: a.jobId, company: a.company, title: a.title, stage: a.stage, resumes: a.resumeId ? 1 : 0, updatedAt: prior && prior.updatedAt > a.updatedAt ? prior.updatedAt : a.updatedAt });
  }
  const jobIds = [...byJob.keys()];
  if (!jobIds.length) return [];

  const [resumes, packets, matches] = await Promise.all([
    db.query.resume.findMany({ where: and(eq(schema.resume.userId, userId), inArray(schema.resume.jobId, jobIds)), columns: { jobId: true, createdAt: true } }),
    db.query.applicationPacket.findMany({ where: and(eq(schema.applicationPacket.userId, userId), inArray(schema.applicationPacket.jobId, jobIds)) }),
    db.query.jobMatch.findMany({ where: and(eq(schema.jobMatch.userId, userId), inArray(schema.jobMatch.jobId, jobIds)), columns: { jobId: true, fit: true } }),
  ]);
  for (const m of matches) if (!fitByJob.get(m.jobId)) fitByJob.set(m.jobId, (m.fit as FitReport | null) ?? null);
  const newestResume = new Map<string, Date>();
  for (const r of resumes) {
    const c = r.jobId ? byJob.get(r.jobId) : undefined;
    if (!c || !r.jobId) continue;
    c.resumes += 1;
    const prev = newestResume.get(r.jobId);
    if (!prev || r.createdAt > prev) newestResume.set(r.jobId, r.createdAt);
  }
  for (const p of packets) {
    const c = byJob.get(p.jobId);
    if (c) c.letter = letterStatus(readLetter(p));
  }
  for (const c of byJob.values()) {
    const fit = fitByJob.get(c.jobId);
    c.openGaps = fit?.details ? skillGaps(fit, declined).length : 0;
    const built = newestResume.get(c.jobId);
    c.stale = Boolean(built && factAt && factAt > built);
  }
  return [...byJob.values()];
}

/** Loads the student's journey. Reads only; safe to call on every Today render. */
export async function loadJourney(userId: string): Promise<Journey> {
  const [facts, experiences, jobs, base, bullets, confirmedFacts] = await Promise.all([
    factCounts(userId),
    listExperiences(userId),
    loadJobProgress(userId),
    db.query.resume.findFirst({ where: and(eq(schema.resume.userId, userId), isNull(schema.resume.jobId)), columns: { id: true } }),
    listBullets(userId),
    listFacts(userId, { states: ["confirmed"] }),
  ]);
  const confirmed = new Map(confirmedFacts.map((fact) => [fact.id, fact.content]));
  const usableBullets = bullets.filter((bullet) => bullet.status === "active" && bullet.factIds.length > 0 &&
    bullet.factIds.every((id) => confirmed.has(id)) &&
    verifyBullet(bullet.text, bullet.factIds.map((id) => confirmed.get(id)!)).ok).length;
  return buildJourney({
    confirmedFacts: facts.confirmed,
    pendingFacts: facts.toReview,
    usableBullets,
    experiences: experiences.length,
    baseResume: Boolean(base),
    focus: pickFocus(jobs),
  });
}

/** "business internships in Raleigh for Summer 2027", from onboarding goals. Null when there's no role. */
export function firstSearch(profile: { targetRoles?: string[]; targetLocations?: string[]; targetTerm?: string | null } | null | undefined): string | null {
  const role = profile?.targetRoles?.[0]?.trim();
  if (!role) return null;
  const where = profile?.targetLocations?.find((l) => !/^remote$/i.test(l));
  return [role, where ? `in ${where}` : "", profile?.targetTerm ? `for ${profile.targetTerm}` : ""].filter(Boolean).join(" ");
}
