import { and, asc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { emailConfigured, sendEmail } from "@/lib/email";
import { site } from "@/lib/site";
import { logEvent } from "./events";
import { clearRunFailure, recordRunFailure } from "./failure";
import { runLoop, type LoopSummary } from "./loop";

/**
 * The morning run. A person who turns it on gets the same loop they would start by
 * hand (live check, resume, cover letter, review) without opening the page. It
 * keeps every limit of the manual run: three roles a run, nine a day, nothing
 * submitted, no fact written. When it finds something it can email a short note,
 * if mail is set up; otherwise the Ready page and Home card show it.
 */

/** A run younger than this is skipped, so a repeated cron call never spends a person's day twice. */
export const MIN_HOURS_BETWEEN_RUNS = 20;

export type ScheduleDeps = {
  run: (userId: string, email: string) => Promise<LoopSummary>;
  send: typeof sendEmail;
  mailConfigured: () => boolean;
  now: () => Date;
};

const defaultDeps: ScheduleDeps = { run: (userId, email) => runLoop(userId, email), send: sendEmail, mailConfigured: emailConfigured, now: () => new Date() };

export type ScheduleStats = { opted: number; ran: number; skipped: number; failed: number; ready: number; needsYou: number; emailed: number; stoppedEarly: boolean };

type Found = { title: string; company: string; reason: string | null };

/** What this run left on the Ready page, for the note. */
async function foundSince(userId: string, since: Date): Promise<{ ready: Found[]; needsYou: Found[] }> {
  const rows = await db
    .select({ status: schema.agentRun.status, reason: schema.agentRun.reason, title: schema.job.title, company: schema.job.company })
    .from(schema.agentRun)
    .innerJoin(schema.job, eq(schema.job.id, schema.agentRun.jobId))
    .where(and(eq(schema.agentRun.userId, userId), isNull(schema.agentRun.dismissedAt), gte(schema.agentRun.updatedAt, since)));
  const pick = (status: string) => rows.filter((r) => r.status === status).map(({ title, company, reason }) => ({ title, company, reason }));
  return { ready: pick("ready"), needsYou: pick("needs_you") };
}

const line = (f: Found) => `- ${f.title} at ${f.company}`;

/** Plain text, no tracking, nothing to click but one link. */
export function digestEmail(found: { ready: Found[]; needsYou: Found[] }): { subject: string; text: string } {
  const { ready, needsYou } = found;
  const parts = [ready.length ? `${ready.length} ready` : null, needsYou.length ? `${needsYou.length} waiting on you` : null].filter(Boolean);
  const text = [
    "Proofline looked for open jobs this morning.",
    "",
    ...(ready.length ? ["Ready (the resume and the cover letter passed review):", ...ready.map(line), ""] : []),
    ...(needsYou.length ? ["Waiting on you:", ...needsYou.map((f) => `${line(f)}${f.reason ? `. ${f.reason}` : ""}`), ""] : []),
    `Open ${site.url}/app/ready to read them and apply. Proofline never applies for you.`,
    "",
    "You can turn the morning run off at the top of that page.",
  ].join("\n");
  return { subject: ready.length ? `${ready.length === 1 ? "1 job is" : `${ready.length} jobs are`} ready to apply` : `Proofline: ${parts.join(", ")}`, text };
}

/**
 * Runs the loop for every person who turned the morning run on, the one who has
 * waited longest first, until the time budget is spent. A person whose run fails
 * is counted and skipped; it never stops the others.
 */
export async function runScheduled(opts: { deadline?: Date; deps?: Partial<ScheduleDeps> } = {}): Promise<ScheduleStats> {
  const deps: ScheduleDeps = { ...defaultDeps, ...opts.deps };
  const stats: ScheduleStats = { opted: 0, ran: 0, skipped: 0, failed: 0, ready: 0, needsYou: 0, emailed: 0, stoppedEarly: false };
  const start = deps.now();
  const recent = new Date(start.getTime() - MIN_HOURS_BETWEEN_RUNS * 36e5);

  const people = await db
    .select({ userId: schema.profile.userId, email: schema.user.email, lastAutoRunAt: schema.profile.lastAutoRunAt })
    .from(schema.profile)
    .innerJoin(schema.user, eq(schema.user.id, schema.profile.userId))
    .where(eq(schema.profile.autoRun, true))
    .orderBy(sql`${schema.profile.lastAutoRunAt} asc nulls first`, asc(schema.profile.userId));
  stats.opted = people.length;

  for (const person of people) {
    if (opts.deadline && deps.now() >= opts.deadline) {
      stats.stoppedEarly = true;
      break;
    }
    if (person.lastAutoRunAt && person.lastAutoRunAt > recent) {
      stats.skipped++;
      continue;
    }
    // Marked first, so a run that crashes is not retried in a loop by the next cron call.
    const began = deps.now();
    const [claimed] = await db
      .update(schema.profile)
      .set({ lastAutoRunAt: began })
      .where(and(eq(schema.profile.userId, person.userId), eq(schema.profile.autoRun, true), or(isNull(schema.profile.lastAutoRunAt), lt(schema.profile.lastAutoRunAt, recent))))
      .returning({ userId: schema.profile.userId });
    if (!claimed) {
      stats.skipped++;
      continue;
    }
    try {
      const summary = await deps.run(person.userId, person.email);
      await clearRunFailure(person.userId, "later_run");
      stats.ran++;
      stats.ready += summary.ready;
      stats.needsYou += summary.needsYou;
      await logEvent(person.userId, "loop_scheduled", { ready: summary.ready, needsYou: summary.needsYou, skipped: summary.skipped, blocked: summary.blocked });
      if (deps.mailConfigured() && (summary.ready || summary.needsYou)) {
        const found = await foundSince(person.userId, began);
        if (found.ready.length || found.needsYou.length) {
          const note = digestEmail(found);
          if ((await deps.send({ to: person.email, subject: note.subject, text: note.text })) === "sent") stats.emailed++;
        }
      }
    } catch (error) {
      stats.failed++;
      // Logged with a code and kept on the person's Ready page, so a morning run that stopped is not silent.
      await recordRunFailure(person.userId, "morning", error, deps.now());
    }
  }
  return stats;
}
