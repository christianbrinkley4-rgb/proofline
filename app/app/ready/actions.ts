"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { logEvent } from "@/lib/agent/events";
import { runLoop, type LoopSummary } from "@/lib/agent/loop";
import { addRule, companyRule, removeRule, titleWordRule } from "@/lib/agent/rules";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { setMatchStatus } from "@/lib/jobs/store";
import { deleteApplication } from "@/lib/tracker/service";

function refresh() {
  revalidatePath("/app/ready");
  revalidatePath("/app/find");
  revalidatePath("/app/tracker");
  revalidatePath("/app/jobs");
}

/** Works through the next few best-fitting open roles. Runs for up to about two minutes. */
export async function runLoopAction(): Promise<{ ok: true; summary: LoopSummary } | { ok: false; error: string }> {
  const session = await requireSession();
  try {
    const summary = await runLoop(session.user.id, session.user.email);
    refresh();
    return { ok: true, summary };
  } catch {
    refresh();
    return { ok: false, error: "Something stopped the run. Whatever finished is saved below; try again in a minute." };
  }
}

const Choice = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("one") }),
  z.object({ kind: z.literal("company") }),
  z.object({ kind: z.literal("word"), word: z.string().max(60) }),
]);

/**
 * "Not for me" on a result. The role leaves the list and the tracker (if the person
 * hasn't moved it past Saved), and a company or title-word correction becomes a
 * standing rule that Find jobs and later runs also follow.
 */
export async function dismissRunAction(runId: string, choice: z.input<typeof Choice>): Promise<{ ok: true; rule: string | null } | { ok: false; error: string }> {
  const session = await requireSession();
  const userId = session.user.id;
  const parsedChoice = Choice.safeParse(choice);
  const id = z.uuid().safeParse(runId);
  if (!parsedChoice.success || !id.success) return { ok: false, error: "That didn't go through. Reload and try again." };
  const run = await db.query.agentRun.findFirst({ where: and(eq(schema.agentRun.id, id.data), eq(schema.agentRun.userId, userId)) });
  const job = run ? await db.query.job.findFirst({ where: eq(schema.job.id, run.jobId) }) : null;
  if (!run || !job) return { ok: false, error: "That role isn't on your list anymore." };

  let rule: string | null = null;
  if (parsedChoice.data.kind === "company") rule = companyRule(job.company);
  if (parsedChoice.data.kind === "word") {
    rule = titleWordRule(parsedChoice.data.word);
    if (!rule) return { ok: false, error: "Use one or two plain words from the title, like senior or sales." };
  }
  try {
    if (rule) await addRule(userId, rule, { jobId: job.id });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't save that rule." };
  }

  const reason = parsedChoice.data.kind === "company" ? "Not interested in this company" : parsedChoice.data.kind === "word" ? "Wrong kind of role" : "Not for me";
  await setMatchStatus(userId, job.id, "dismissed", reason);
  await logEvent(userId, "job_dismissed", { jobId: job.id, reason, via: "ready", company: job.company, title: job.title, mode: job.mode, location: job.location });
  await logEvent(userId, "loop_role_dismissed", { runId: run.id, jobId: job.id, rule });
  await db.update(schema.agentRun).set({ dismissedAt: new Date() }).where(eq(schema.agentRun.id, run.id));

  // The loop saved this role to the tracker; take it back off unless the person has moved it along.
  if (run.applicationId) {
    const app = await db.query.application.findFirst({ where: and(eq(schema.application.id, run.applicationId), eq(schema.application.userId, userId)) });
    if (app && app.stage === "saved" && !app.appliedAt) await deleteApplication(userId, app.id);
  }
  refresh();
  return { ok: true, rule };
}

export async function removeRuleAction(raw: string): Promise<void> {
  const session = await requireSession();
  await removeRule(session.user.id, z.string().min(1).max(200).parse(raw));
  refresh();
}
