import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { TrackerBoard, type ApplicationInsight } from "@/components/tracker/tracker-board";
import { parseApplicationActivity } from "@/lib/tracker/activity";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { requirementsOf } from "@/lib/jobs/store";
import { listApplications } from "@/lib/tracker/service";

export const metadata: Metadata = { title: "Application tracker" };
export default async function TrackerPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const session = await requireSession();
  const userId = session.user.id;
  const { app: openApp } = await searchParams;
  const [applications, candidate, resumes, events] = await Promise.all([
    listApplications(userId), loadCandidate(userId),
    db.query.resume.findMany({ where: eq(schema.resume.userId, userId), columns: { id: true, jobId: true } }),
    db.query.agentEvent.findMany({ where: and(eq(schema.agentEvent.userId, userId), inArray(schema.agentEvent.type, ["application_stage_changed", "application_reply_recorded", "resume_linked", "follow_up_recorded"])), orderBy: [desc(schema.agentEvent.createdAt)] }),
  ]);
  const jobIds = [...new Set(applications.flatMap((a) => a.jobId ? [a.jobId] : []))];
  const jobs = jobIds.length ? await db.query.job.findMany({ where: inArray(schema.job.id, jobIds) }) : [];
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const insights: Record<string, ApplicationInsight> = {};
  for (const app of applications) {
    const job = app.jobId ? byId.get(app.jobId) : null;
    if (!job) continue;
    const fit = scoreFit({ ...job, requirements: requirementsOf(job) }, candidate);
    const steps: string[] = [];
    if (fit.details.requiredSkills.missing.length) steps.push("If you have used " + fit.details.requiredSkills.missing.slice(0, 2).join(" or ") + ", add a specific example to your profile. Otherwise, build a small project to gain that experience.");
    if (fit.strengths.length) steps.push("Prepare a short example that demonstrates: " + fit.strengths[0] + ".");
    steps.push(app.resumeId ? "Review the attached resume against the full posting before your next conversation." : "Build the tailored resume on the job's Tailor tab and track it with that version.");
    if (app.stage === "interview") steps.push("Prepare two stories about your work: the problem, your own contribution, and the result.");
    insights[app.id] = { score: fit.score, strengths: fit.strengths, gaps: fit.gaps, nextSteps: steps.slice(0, 4), versions: resumes.filter((r) => r.jobId === job.id).length };
  }
  const activity = parseApplicationActivity(events);
  const initialAppId = typeof openApp === "string" && applications.some((a) => a.id === openApp) ? openApp : null;
  return <PageBody className="max-w-[1600px]"><PageHeader title="Tracker" description="Every application on one board. Mark a role Applied and a follow-up comes due 14 days later." /><TrackerBoard applications={applications} insights={insights} activity={activity} name={session.user.name} now={new Date().toISOString()} initialAppId={initialAppId} /></PageBody>;
}

