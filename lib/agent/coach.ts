import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { listMatches } from "@/lib/jobs/store";
import { listExperiences } from "@/lib/kb/experiences";
import { factCounts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { letterStatus, type LetterStatus } from "@/lib/packet/cover-letter";
import { readLetter } from "@/lib/packet/service";
import { listApplications, type Application } from "@/lib/tracker/service";
import { storyReady } from "./story-ready";

export { storyReady };

/**
 * The coach: one application walked through Story, Find, Fit, Resume, Packet,
 * Track, with exactly one next step at a time. Pure rules over the student's
 * own state, so Today, the job page, the packet, and chat all agree on what
 * comes next.
 */

export const JOURNEY = [
  { id: "story", label: "Story" },
  { id: "find", label: "Find" },
  { id: "fit", label: "Fit" },
  { id: "resume", label: "Resume" },
  { id: "packet", label: "Packet" },
  { id: "track", label: "Track" },
] as const;

export type JourneyStepId = (typeof JOURNEY)[number]["id"];
export type StepState = "done" | "current" | "upcoming";

/** Stages after the student has applied. */
const SENT = new Set(["applied", "assessment", "interview", "offer", "rejected"]);

/** The one job the coach is walking the student through. */
export type FocusJob = {
  jobId: string;
  company: string;
  title: string;
  /** Tracker stage, or null when the job is saved but not tracked. */
  stage: string | null;
  /** Resume versions built for this job. */
  resumes: number;
  letter: LetterStatus;
};

export type JourneyInput = {
  confirmedFacts: number;
  pendingFacts: number;
  experiences: number;
  /** True once any search has produced matches. */
  searched: boolean;
  /** A first search built from the student's goals, e.g. "business internships in Raleigh". */
  suggestedQuery: string | null;
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
  /** The step in progress, or "done" when the focus job has been sent. */
  current: JourneyStepId | "done";
  action: CoachAction;
  focus: FocusJob | null;
  /** 1-based position of the current step, for "Step 4 of 6". */
  position: number;
};

function stepDone(id: JourneyStepId, input: JourneyInput): boolean {
  const f = input.focus;
  switch (id) {
    case "story":
      return storyReady(input);
    case "find":
      return input.searched || Boolean(f);
    case "fit":
      return Boolean(f);
    case "resume":
      return Boolean(f && f.resumes > 0);
    case "packet":
      return Boolean(f && f.letter === "ready");
    case "track":
      return Boolean(f?.stage && SENT.has(f.stage));
  }
}

function actionFor(id: JourneyStepId | "done", input: JourneyInput): CoachAction {
  const f = input.focus;
  const at = f ? ` for ${f.company}` : "";
  switch (id) {
    case "story":
      return input.pendingFacts > 0 && input.confirmedFacts === 0
        ? {
            title: "Check what I found about you",
            detail: `${input.pendingFacts} ${input.pendingFacts === 1 ? "fact is" : "facts are"} waiting for a yes. Only confirmed facts can go on a resume, so this comes first.`,
            href: "/app/profile",
            cta: "Review facts",
          }
        : {
            title: "Tell me about one thing you've done",
            detail: "A job, a class project, a club, volunteering. Talk it out or upload a resume. I need a little real evidence before I can match or write anything.",
            href: "/app/profile#start",
            cta: "Add your story",
          };
    case "find":
      return {
        title: input.suggestedQuery ? "Run your first search" : "Search for roles worth your time",
        detail: input.suggestedQuery
          ? `I'll start with "${input.suggestedQuery}" and score every posting against your confirmed facts.`
          : "Describe the job you want in plain words. I'll search live employer boards and score what I find.",
        href: input.suggestedQuery ? `/app/jobs?q=${encodeURIComponent(input.suggestedQuery)}` : "/app/jobs",
        cta: "Search jobs",
      };
    case "fit":
      return {
        title: "Pick one job worth your time",
        detail: "Open your best match, read why it scored the way it did, and save it. One careful application beats ten rushed ones.",
        href: "/app/jobs",
        cta: "Review matches",
      };
    case "resume":
      return {
        title: `Build your resume${at}`,
        detail: "Compare three one-page versions built from your confirmed facts, then keep the one you can defend line by line.",
        href: `/app/resumes/compare?job=${f!.jobId}`,
        cta: "Compare resumes",
      };
    case "packet":
      return f!.letter === "needs_you"
        ? {
            title: `Say why you want ${f!.company}`,
            detail: "Your cover letter is drafted from your evidence. The one part I won't write is why you want this job. A sentence or two in your words finishes it.",
            href: `/app/jobs/${f!.jobId}/packet#letter`,
            cta: "Finish the letter",
          }
        : {
            title: `Draft your cover letter${at}`,
            detail: "It's built from the same confirmed facts as your resume, and shows the fact behind every paragraph.",
            href: `/app/jobs/${f!.jobId}/packet#letter`,
            cta: "Open the packet",
          };
    case "track":
      return {
        title: `Apply to ${f!.company}, then mark it applied`,
        detail: "You submit on the employer's site. Mark it applied here and I'll remind you when to follow up and draft the email.",
        href: `/app/jobs/${f!.jobId}/packet#tracking`,
        cta: "Apply and track",
      };
    case "done":
      return {
        title: "Start your next application",
        detail: f ? `${f.company} is in motion. I'll remind you when a follow-up is due. Meanwhile, line up the next role.` : "Line up the next role.",
        href: input.suggestedQuery ? `/app/jobs?q=${encodeURIComponent(input.suggestedQuery)}` : "/app/jobs",
        cta: "Find another role",
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
 * The job to walk through next: an unsent one furthest along (has a resume, then a
 * ready letter), newest first. When everything is sent, the newest sent one, so
 * the rail can show a finished loop.
 */
export function pickFocus(candidates: FocusCandidate[]): FocusJob | null {
  const progress = (c: FocusCandidate) => (c.resumes > 0 ? 2 : 0) + (c.letter === "ready" ? 1 : 0);
  const open = candidates.filter((c) => !c.stage || !SENT.has(c.stage));
  const pool = open.length ? open : candidates.filter((c) => c.stage !== "rejected");
  const best = [...pool].sort((a, b) => progress(b) - progress(a) || b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  if (!best) return null;
  return { jobId: best.jobId, company: best.company, title: best.title, stage: best.stage, resumes: best.resumes, letter: best.letter };
}

/** What the job page should put first, given how far this job has come. */
export type JobPlan = {
  primary: "resume" | "packet" | "apply" | "prep" | "story";
  /** Short label for the coach line above the actions. */
  note: string;
};

export function jobPlan(input: { resumes: number; letter: LetterStatus; stage: string | null; capped: boolean; storyReady: boolean }): JobPlan {
  if (input.stage === "interview") return { primary: "prep", note: "You have an interview. Practice with the stories you already have." };
  if (input.stage && SENT.has(input.stage)) return { primary: "apply", note: "Applied. Your tracker has the follow-up reminder." };
  if (!input.storyReady) return { primary: "story", note: "Add a little evidence first. Your score and resume both come from confirmed facts." };
  if (input.resumes === 0 && !input.capped) return { primary: "resume", note: "Next: build a resume for this role." };
  if (input.letter !== "ready") return { primary: "packet", note: input.letter === "needs_you" ? "Next: add why you want this job, then your letter is ready." : "Next: draft your cover letter." };
  return { primary: "apply", note: "Your packet is ready. Apply on their site, then mark it applied." };
}

/** Packet order: attach a resume, write the letter and the why, then apply and track. */
export type PacketStep = "resume" | "letter" | "track" | "done";

export function packetStep(input: { resumes: number; attached: boolean; letter: LetterStatus; stage: string | null }): PacketStep {
  if (input.stage && SENT.has(input.stage)) return "done";
  if (input.resumes === 0) return "resume";
  if (input.letter !== "ready") return "letter";
  return "track";
}

/** Every saved or tracked job with how far its application has come. */
export async function loadJobProgress(userId: string, applications?: Application[]): Promise<FocusCandidate[]> {
  const [apps, saved] = await Promise.all([applications ?? listApplications(userId), listMatches(userId, ["saved"], 20)]);
  const byJob = new Map<string, FocusCandidate>();
  for (const a of apps) {
    if (!a.jobId) continue;
    byJob.set(a.jobId, { jobId: a.jobId, company: a.company, title: a.title, stage: a.stage, resumes: a.resumeId ? 1 : 0, letter: "none", updatedAt: a.updatedAt });
  }
  for (const { job, match } of saved) {
    if (byJob.has(job.id)) continue;
    byJob.set(job.id, { jobId: job.id, company: job.company, title: job.title, stage: null, resumes: 0, letter: "none", updatedAt: match.updatedAt });
  }
  const jobIds = [...byJob.keys()];
  if (jobIds.length) {
    const [resumes, packets] = await Promise.all([
      db.query.resume.findMany({ where: and(eq(schema.resume.userId, userId), inArray(schema.resume.jobId, jobIds)), columns: { jobId: true } }),
      db.query.applicationPacket.findMany({ where: and(eq(schema.applicationPacket.userId, userId), inArray(schema.applicationPacket.jobId, jobIds)) }),
    ]);
    for (const r of resumes) {
      const c = r.jobId ? byJob.get(r.jobId) : undefined;
      if (c) c.resumes += 1;
    }
    for (const p of packets) {
      const c = byJob.get(p.jobId);
      if (c) c.letter = letterStatus(readLetter(p));
    }
  }
  return [...byJob.values()];
}

export function isSent(stage: string | null): boolean {
  return Boolean(stage && SENT.has(stage));
}

/** Loads the student's journey. Reads only; safe to call on every Today render. */
export async function loadJourney(userId: string): Promise<Journey> {
  const [facts, experiences, jobs, anyMatch, profile] = await Promise.all([
    factCounts(userId),
    listExperiences(userId),
    loadJobProgress(userId),
    db.query.jobMatch.findFirst({ where: eq(schema.jobMatch.userId, userId), columns: { id: true } }),
    getProfile(userId),
  ]);
  return buildJourney({
    confirmedFacts: facts.confirmed,
    pendingFacts: facts.toReview,
    experiences: experiences.length,
    searched: Boolean(anyMatch),
    suggestedQuery: firstSearch(profile),
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
