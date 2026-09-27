import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ActionForm, CheckinForm } from "@/components/career/career-forms";
import { FeedbackControl } from "@/components/feedback/feedback-control";
import { requireSession } from "@/lib/auth";
import { careerDashboard } from "@/lib/career/service";
import { getProfile } from "@/lib/kb/profile";
import { recordCareerCheckinAction, saveCareerGoalAction } from "./actions";

export const metadata: Metadata = { title: "Career plan" };

const card = "rounded-2xl border bg-card p-5 shadow-xs";

/** "2027-05" reads as "May 2027". */
function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function CareerPage() {
  const userId = (await requireSession()).user.id;
  const [dashboard, profile] = await Promise.all([careerDashboard(userId), getProfile(userId)]);
  const { goal, archived, current, checkins, actions, benchmark, options } = dashboard;
  const first = checkins.at(-1);
  const latest = checkins[0];

  return <PageBody className="max-w-5xl">
    <PageHeader title="Your career plan" description="Pick a direction, compare your confirmed evidence with a real posting, and save check-ins as you grow." />

    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-6">
        {goal && current && <>
          <section className={card}>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Current goal</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">{goal.targetRole}</h2>
            {goal.targetMonth && <p className="mt-1 text-sm text-muted-foreground">Target: {monthLabel(goal.targetMonth)}</p>}
            {goal.motivation && <p className="mt-3 text-sm leading-6">{goal.motivation}</p>}
            <p className="mt-3 text-sm text-muted-foreground">
              {benchmark ? <>Compared with <Link className="font-medium text-foreground underline" href={`/app/jobs/${benchmark.id}`}>{benchmark.title} at {benchmark.company}</Link>.</> : goal.targetRole === "Explore career directions" ? "You can explore without choosing a job yet. Try a few small experiments before setting a target role." : "Add a saved posting with its full description to make this plan job specific."}
            </p>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold">What your profile shows now</h2>
            <p className="mt-1 text-sm text-muted-foreground">These are evidence counts, not a prediction of hiring success.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Measure label="Confirmed facts" value={current.confirmedFacts} change={first ? current.confirmedFacts - first.confirmedFacts : null} />
              <Measure label="Verified bullets" value={current.activeBullets} change={first ? current.activeBullets - first.activeBullets : null} />
              {benchmark && <>
                <Measure label="Posting-related bullets" value={current.relevantBullets} change={first ? current.relevantBullets - first.relevantBullets : null} />
                <Measure label="Required skills shown" value={`${current.matchedRequired ?? 0}/${current.totalRequired ?? 0}`} change={null} />
              </>}
            </div>
            <CheckinForm action={recordCareerCheckinAction}>
              <input type="hidden" name="goalId" value={goal.id} />
              <label className="mb-3 block text-sm font-medium">What did you learn? <span className="font-normal text-muted-foreground">(optional)</span>
                <textarea name="reflection" maxLength={1000} rows={3} placeholder="A conversation, small experiment, setback, or next question..." className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 font-normal" />
              </label>
              {goal.targetRole === "Explore career directions" && actions.length > 0 && <label className="mb-3 block text-sm font-medium">Step completed <span className="font-normal text-muted-foreground">(optional)</span>
                <select name="completedActionId" defaultValue="" className="mt-1.5 block w-full rounded-md border bg-background px-3 py-2 font-normal">
                  <option value="">I am still working on these steps</option>
                  {actions.map((action) => <option key={action.id} value={action.id}>{action.title}</option>)}
                </select>
              </label>}
            </CheckinForm>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold">Next moves</h2>
            <ol className="mt-4 space-y-3">
              {actions.map((action, index) => <li key={action.id} className="rounded-xl border p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
                  <div>
                    <h3 className="text-sm font-semibold">{action.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.detail}</p>
                    <Link className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4" href={action.href}>Take this step<span className="sr-only">: {action.title}</span></Link>
                  </div>
                </div>
              </li>)}
            </ol>
            {actions.length === 0 && <p className="mt-4 text-sm leading-6 text-muted-foreground">You have completed these exploration steps. Review what you learned, then use Change direction to test a role that now interests you.</p>}
          </section>

          <FeedbackControl kind="career_plan" subjectId={goal.id} />

          <section className={card}>
            <h2 className="text-lg font-semibold">Your trajectory</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each entry is a snapshot of confirmed evidence on that date. A setback is a useful signal to review changed or unconfirmed facts.</p>
            <ol className="mt-4 space-y-3">
              {checkins.map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <time dateTime={entry.createdAt.toISOString()} className="font-medium">{entry.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</time>
                <span className="text-muted-foreground">{entry.confirmedFacts} facts · {entry.activeBullets} bullets{benchmark && entry.totalRequired != null ? ` · ${entry.matchedRequired}/${entry.totalRequired} required skills` : ""}</span>
                {entry.completedActionId && <p className="w-full text-xs font-medium text-primary">Completed: {entry.completedActionId.replaceAll("-", " ")}</p>}
                {entry.reflection && <p className="w-full text-sm leading-6">{entry.reflection}</p>}
              </li>)}
            </ol>
            {latest && first && latest.id === first.id && <p className="mt-3 text-xs text-muted-foreground">Your first check-in is the baseline. Add evidence, then save another to see change.</p>}
          </section>
        </>}

        {!goal && <section className={card}>
          <h2 className="text-xl font-semibold">Set a direction</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">This goal guides your plan. It never becomes a claim on a resume. You can change direction as you learn more.</p>
          <p className="mt-2 text-sm leading-6">
            No job title in mind yet? <a href="#explore" className="font-medium underline underline-offset-4">Start by exploring instead</a>.
          </p>
          <GoalForm defaultRole={profile?.targetRoles[0] ?? ""} options={options} submitLabel="Start my plan" />
        </section>}
      </div>

      <aside className="space-y-4">
        {goal && <section className={card}>
          <h2 className="text-sm font-semibold">Change direction</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">A new goal starts a fresh trajectory. Your earlier goals remain below.</p>
          {/* Starts empty: resubmitting the current role by accident would restart its trajectory. */}
          <GoalForm defaultRole="" options={options} submitLabel="Start a new goal" />
        </section>}
        {!goal && <section id="explore" className={card}>
          <h2 className="text-sm font-semibold">Still figuring it out?</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">You do not need a job title yet. Start by noticing what gives you energy, what drains you, and what constraints are real. Your plan will focus on small experiments.</p>
          <ActionForm action={saveCareerGoalAction} submitLabel="Help me explore" variant="outline" className="mt-4 space-y-3">
            <input type="hidden" name="targetRole" value="Explore career directions" />
            <label className="block text-sm font-medium">What do you know about yourself so far?
              <textarea name="motivation" maxLength={500} rows={4} placeholder="I enjoy helping people solve problems, but I do not know which jobs are like that..." className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 font-normal" />
            </label>
          </ActionForm>
        </section>}
        {archived.length > 0 && <section className={card}>
          <h2 className="text-sm font-semibold">Earlier directions</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {archived.map((item) => <li key={item.id}>{item.targetRole} <span className="text-xs">· {item.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "short" })}</span></li>)}
          </ul>
        </section>}
        <section className={card}>
          <h2 className="text-sm font-semibold">Ground rules</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">A posting describes what an employer asks for. Your profile shows what you have confirmed. Missing requirements become questions or practice steps, never invented experience.</p>
        </section>
      </aside>
    </div>
  </PageBody>;
}

function Measure({ label, value, change }: { label: string; value: number | string; change: number | null }) {
  return <div className="rounded-xl bg-muted/60 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    {change !== null && change !== 0 && <p className="text-xs text-muted-foreground">{change > 0 ? `+${change}` : change} since start</p>}
  </div>;
}

function GoalForm({ defaultRole, options, submitLabel }: { defaultRole: string; options: Array<{ id: string; title: string; company: string }>; submitLabel: string }) {
  return <ActionForm action={saveCareerGoalAction} submitLabel={submitLabel} className="mt-4 space-y-4">
    <label className="block text-sm font-medium">Career goal
      <input name="targetRole" required minLength={2} maxLength={100} defaultValue={defaultRole} placeholder="e.g. Data analyst" className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 font-normal" />
    </label>
    <label className="block text-sm font-medium">Target month <span className="font-normal text-muted-foreground">(optional)</span>
      <input name="targetMonth" type="month" className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 font-normal" />
    </label>
    <label className="block text-sm font-medium">Why this direction? <span className="font-normal text-muted-foreground">(optional)</span>
      <textarea name="motivation" maxLength={500} rows={3} placeholder="What draws you to this work?" className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 font-normal" />
    </label>
    <label className="block text-sm font-medium">Compare with a job you pasted <span className="font-normal text-muted-foreground">(optional)</span>
      <span className="mt-0.5 block text-xs font-normal leading-5 text-muted-foreground">Your plan will count which of its required skills your confirmed facts already show.</span>
      <select name="benchmarkJobId" defaultValue="" className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 font-normal">
        <option value="">Choose later</option>
        {options.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company}</option>)}
      </select>
    </label>
    {options.length === 0 && <p className="text-xs leading-5 text-muted-foreground">Save a job with its full description on the <Link href="/app/jobs" className="underline">Jobs page</Link> to get posting-specific guidance.</p>}
  </ActionForm>;
}
