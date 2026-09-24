import { factCounts } from "@/lib/kb/facts";
import { listOpenQuestions } from "@/lib/kb/questions";
import { listApplications } from "@/lib/tracker/service";
import { listWatched } from "@/lib/jobs/saved";

/** One thing the student should do next, with where to do it. */
export type NextMove = { kind: "verify" | "follow_up" | "resume" | "prep" | "deadline" | "explore" | "news"; title: string; detail: string; href: string };

/** The most useful next actions, in priority order. Shared by the Agent page and chat. */
export async function nextMoves(userId: string, now = new Date()): Promise<NextMove[]> {
  const [facts, questions, applications, watched] = await Promise.all([factCounts(userId), listOpenQuestions(userId), listApplications(userId), listWatched(userId)]);
  const moves: NextMove[] = [];

  const soon = new Date(now.getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  for (const app of applications.filter((a) => a.deadline && a.deadline >= today && a.deadline <= soon && ["saved", "applied", "assessment"].includes(a.stage))) {
    moves.push({
      kind: "deadline",
      title: `${app.company} deadline ${app.deadline === today ? "today" : "this week"}`,
      detail: `${app.title}. Due ${app.deadline}.`,
      href: "/app/tracker",
    });
  }
  for (const app of applications.filter((a) => a.stage === "applied" && a.nextFollowUpAt && a.nextFollowUpAt <= now).slice(0, 3)) {
    moves.push({
      kind: "follow_up",
      title: `Follow up with ${app.company}`,
      detail: `Review a draft for your ${app.title} application, then record it after you send it.`,
      href: "/app/tracker",
    });
  }
  for (const app of applications.filter((a) => a.stage === "interview" && a.jobId).slice(0, 2)) {
    moves.push({
      kind: "prep",
      title: `Prepare for your ${app.company} interview`,
      detail: `Practice likely questions for ${app.title} with the stories you already have.`,
      href: `/app/jobs/${app.jobId}/packet#interview`,
    });
  }
  for (const w of watched.filter((x) => x.newJobIds.length).slice(0, 2)) {
    const n = w.newJobIds.length;
    moves.push({
      kind: "news",
      title: `${n} new ${n === 1 ? "match" : "matches"} for "${w.query}"`,
      detail: "Found since you last looked. Open the search to see how each one fits.",
      href: `/app/jobs?q=${encodeURIComponent(w.query)}`,
    });
  }
  const waiting = facts.toReview + questions.length;
  if (waiting) {
    moves.push({
      kind: "verify",
      title: "Verify your story",
      detail: `${waiting} ${waiting === 1 ? "fact or question needs" : "facts or questions need"} your review before ${waiting === 1 ? "it" : "they"} can strengthen a resume.`,
      href: "/app/profile",
    });
  }
  for (const app of applications.filter((a) => a.stage === "saved" && a.jobId && !a.resumeId).slice(0, 2)) {
    moves.push({
      kind: "resume",
      title: `Prepare for ${app.company}`,
      detail: `Compare evidence-backed resume versions and draft a cover letter for ${app.title}.`,
      href: `/app/jobs/${app.jobId}/packet`,
    });
  }
  if (applications.length === 0) {
    moves.push({ kind: "explore", title: "Find roles worth your time", detail: "Search live postings and save one to start tracking your search.", href: "/app/jobs" });
  }
  return moves;
}
