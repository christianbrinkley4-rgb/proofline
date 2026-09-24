import { preferenceSuggestions } from "@/lib/agent/preferences";
import { isSent, loadJobProgress } from "@/lib/agent/coach";
import { listExperiences } from "@/lib/kb/experiences";
import type { LetterStatus } from "@/lib/packet/cover-letter";
import { factCounts } from "@/lib/kb/facts";
import { listOpenQuestions } from "@/lib/kb/questions";
import { listWatched } from "@/lib/jobs/saved";
import { listApplications } from "@/lib/tracker/service";

/** One thing the student should do next, with where to do it. */
export type NextMove = {
  kind: "add_story" | "confirm_facts" | "answer_questions" | "follow_up" | "resume" | "packet" | "prep" | "deadline" | "explore" | "news" | "prefs";
  title: string;
  detail: string;
  href: string;
};

type AppInput = {
  id: string;
  company: string;
  title: string;
  stage: string;
  deadline: string | null;
  nextFollowUpAt: Date | null;
  jobId: string | null;
  resumeId: string | null;
};

type WatchedInput = { query: string; newJobIds: string[] };

/** A saved or tracked job and how far its application has come. */
type JobProgress = { jobId: string; company: string; title: string; hasResume: boolean; letter: LetterStatus; sent: boolean };

/** Inputs for building the list without hitting the DB (tests). */
export type NextMovesInput = {
  factsToReview: number;
  openQuestions: number;
  applications: AppInput[];
  watched: WatchedInput[];
  prefsPending: number;
  /** Cold-start signals. Leave unset to skip the story move. */
  confirmedFacts?: number;
  experiences?: number;
  /** Saved or tracked jobs with their resume and letter state. */
  jobs?: JobProgress[];
  now?: Date;
};

const CAP = 6;

/**
 * Urgency: deadline today > deadline this week > follow-up due > interview prep >
 * news > prefs > verify (facts/questions) > resume > explore.
 */
function urgency(kind: NextMove["kind"], deadlineToday = false): number {
  switch (kind) {
    case "add_story":
      return 3.5;
    case "deadline":
      return deadlineToday ? 0 : 1;
    case "follow_up":
      return 2;
    case "prep":
      return 3;
    case "news":
      return 4;
    case "prefs":
      return 5;
    case "confirm_facts":
    case "answer_questions":
      return 6;
    case "resume":
      return 7;
    case "packet":
      return 7.5;
    case "explore":
      return 8;
  }
}

/** Pure builder: candidates ranked by urgency, capped at ~6. */
export function buildNextMoves(input: NextMovesInput): NextMove[] {
  const now = input.now ?? new Date();
  const soon = new Date(now.getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const ranked: Array<NextMove & { rank: number }> = [];

  const push = (move: NextMove, rank: number) => ranked.push({ ...move, rank });

  for (const app of input.applications.filter(
    (a) => a.deadline && a.deadline >= today && a.deadline <= soon && ["saved", "applied", "assessment"].includes(a.stage),
  )) {
    const deadlineToday = app.deadline === today;
    push(
      {
        kind: "deadline",
        title: `${app.company} deadline ${deadlineToday ? "today" : "this week"}`,
        detail: `${app.title}. Due ${app.deadline}.`,
        href: `/app/tracker?app=${encodeURIComponent(app.id)}`,
      },
      urgency("deadline", deadlineToday),
    );
  }

  for (const app of input.applications.filter((a) => a.stage === "applied" && a.nextFollowUpAt && a.nextFollowUpAt <= now)) {
    push(
      {
        kind: "follow_up",
        title: `Follow up with ${app.company}`,
        detail: `Review a draft for your ${app.title} application, then record it after you send it.`,
        href: `/app/tracker?app=${encodeURIComponent(app.id)}`,
      },
      urgency("follow_up"),
    );
  }

  for (const app of input.applications.filter((a) => a.stage === "interview" && a.jobId)) {
    push(
      {
        kind: "prep",
        title: `Prepare for your ${app.company} interview`,
        detail: `Practice likely questions for ${app.title} with the stories you already have.`,
        href: `/app/jobs/${app.jobId}/packet#interview`,
      },
      urgency("prep"),
    );
  }

  for (const w of input.watched.filter((x) => x.newJobIds.length)) {
    const n = w.newJobIds.length;
    push(
      {
        kind: "news",
        title: `${n} new ${n === 1 ? "match" : "matches"} for "${w.query}"`,
        detail: "Found since you last looked. Open the search to see how each one fits.",
        href: `/app/jobs?q=${encodeURIComponent(w.query)}`,
      },
      urgency("news"),
    );
  }

  if (input.prefsPending > 0) {
    const n = input.prefsPending;
    push(
      {
        kind: "prefs",
        title: n === 1 ? "Review a preference suggestion" : `Review ${n} preference suggestions`,
        detail: "Patterns from roles you've passed on. Nothing changes until you say yes.",
        href: "/app/jobs",
      },
      urgency("prefs"),
    );
  }

  // Cold start: nothing confirmed and nothing to confirm. Everything else depends on a first story.
  const coldStart = input.confirmedFacts === 0 && input.experiences === 0;
  if (coldStart && input.factsToReview === 0) {
    push(
      {
        kind: "add_story",
        title: "Tell your agent about one thing you've done",
        detail: "A job, class project, club, or volunteering. Matches and resumes are built only from what you confirm.",
        href: "/app/profile#start",
      },
      urgency("add_story"),
    );
  }

  if (input.factsToReview > 0) {
    const n = input.factsToReview;
    push(
      {
        kind: "confirm_facts",
        title: "Confirm pending facts",
        detail: `${n} ${n === 1 ? "fact needs" : "facts need"} your review before ${n === 1 ? "it" : "they"} can strengthen a resume.`,
        href: "/app/profile",
      },
      input.confirmedFacts === 0 ? urgency("add_story") : urgency("confirm_facts"),
    );
  }

  if (input.openQuestions > 0) {
    const n = input.openQuestions;
    push(
      {
        kind: "answer_questions",
        title: "Answer open questions",
        detail: `${n} ${n === 1 ? "question is" : "questions are"} waiting so your story stays specific.`,
        href: "/app/profile",
      },
      urgency("answer_questions"),
    );
  }

  for (const app of input.applications.filter((a) => a.stage === "saved" && a.jobId && !a.resumeId)) {
    push(
      {
        kind: "resume",
        title: `Prepare for ${app.company}`,
        detail: `Compare evidence-backed resume versions and draft a cover letter for ${app.title}.`,
        href: `/app/jobs/${app.jobId}/packet`,
      },
      urgency("resume"),
    );
  }

  // Saved jobs that aren't tracked yet still need a resume, then a finished letter.
  const tracked = new Set(input.applications.map((a) => a.jobId).filter(Boolean));
  for (const job of (input.jobs ?? []).filter((j) => !j.sent)) {
    if (!job.hasResume && !tracked.has(job.jobId)) {
      push(
        {
          kind: "resume",
          title: `Build a resume for ${job.company}`,
          detail: `Compare three one-page versions for ${job.title}, built from your confirmed facts.`,
          href: `/app/resumes/compare?job=${job.jobId}`,
        },
        urgency("resume"),
      );
    } else if (job.hasResume && job.letter !== "ready") {
      push(
        {
          kind: "packet",
          title: job.letter === "needs_you" ? `Say why you want ${job.company}` : `Finish your ${job.company} packet`,
          detail:
            job.letter === "needs_you"
              ? "Your letter is drafted from your evidence. Add a sentence or two in your own words and it's ready."
              : `Draft a cover letter for ${job.title} from the same facts as your resume.`,
          href: `/app/jobs/${job.jobId}/packet#letter`,
        },
        urgency("packet"),
      );
    }
  }

  if (input.applications.length === 0 && !(input.jobs ?? []).length) {
    push(
      { kind: "explore", title: "Find roles worth your time", detail: "Search live postings and save one to start tracking your search.", href: "/app/jobs" },
      urgency("explore"),
    );
  }

  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, CAP)
    .map(({ rank: _rank, ...move }) => move);
}

/** The most useful next actions, in priority order. Shared by the Agent page and chat. */
export async function nextMoves(userId: string, now = new Date()): Promise<NextMove[]> {
  const [facts, questions, applications, watched, prefs, experiences] = await Promise.all([
    factCounts(userId),
    listOpenQuestions(userId),
    listApplications(userId),
    listWatched(userId),
    preferenceSuggestions(userId, now),
    listExperiences(userId),
  ]);
  const jobs = await loadJobProgress(userId, applications);
  return buildNextMoves({
    factsToReview: facts.toReview,
    openQuestions: questions.length,
    applications,
    watched,
    prefsPending: prefs.length,
    confirmedFacts: facts.confirmed,
    experiences: experiences.length,
    jobs: jobs.map((j) => ({ jobId: j.jobId, company: j.company, title: j.title, hasResume: j.resumes > 0, letter: j.letter, sent: isSent(j.stage) })),
    now,
  });
}
