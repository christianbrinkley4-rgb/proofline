"use server";

import { monitoredAction } from "@/lib/monitoring/actions";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { captureError } from "@/lib/monitoring/errors";
import { z } from "zod";
import { addReasonToRun, type AddReasonResult } from "@/lib/agent/add-reason";
import { logEvent } from "@/lib/agent/events";
import { clearRunFailure, recordRunFailure, reportError } from "@/lib/agent/failure";
import { recheckRun, runLoop, type LoopSummary, type RecheckResult } from "@/lib/agent/loop";
import { addRule, companyRule, removeRule, titleWordRule } from "@/lib/agent/rules";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { setMatchStatus } from "@/lib/jobs/store";
import { updateProfile } from "@/lib/kb/profile";
import { deleteApplication } from "@/lib/tracker/service";

function refresh() {
  revalidatePath("/app/ready");
  revalidatePath("/app/find");
  revalidatePath("/app/tracker");
  revalidatePath("/app/jobs");
}

/** Works through the next few best-fitting open roles. Runs for up to about two minutes. */
export async function runLoopAction(): Promise<{ ok: true; summary: LoopSummary } | { ok: false; error: string }> {
  return monitoredAction("app/app/ready/actions.ts:runLoopAction", async () => {
    const session = await requireSession();
    try {
      const summary = await runLoop(session.user.id, session.user.email);
      // A run that got through makes an earlier failure notice stale.
      await clearRunFailure(session.user.id, "later_run");
      refresh();
      return { ok: true, summary };
    } catch (error) {
      // The code is also kept on the Ready page, so it outlives the toast.
      const { code } = await recordRunFailure(session.user.id, "run", error);
      refresh();
      return { ok: false, error: `Something stopped the run (code ${code}). Whatever finished is saved below; try again in a minute.` };
    }
  });
}

/** Dismisses the notice for a run that stopped. */
export async function dismissRunFailureAction(): Promise<{ ok: true }> {
  return monitoredAction("app/app/ready/actions.ts:dismissRunFailureAction", async () => {
    const session = await requireSession();
    await clearRunFailure(session.user.id, "dismissed");
    revalidatePath("/app/ready");
    return { ok: true };
  });
}

/** Turns the morning run on or off. It is the person's own setting, off until they choose it. */
export async function setAutoRunAction(on: boolean): Promise<{ ok: true; on: boolean } | { ok: false; error: string }> {
  return monitoredAction("app/app/ready/actions.ts:setAutoRunAction", async () => {
    const session = await requireSession();
    const flag = z.boolean().safeParse(on);
    if (!flag.success) return { ok: false, error: "That didn't go through. Reload and try again." };
    try {
      await updateProfile(session.user.id, { autoRun: flag.data });
      await logEvent(session.user.id, "auto_run_changed", { on: flag.data });
      refresh();
      return { ok: true, on: flag.data };
    } catch (error) {
      captureError(error, "ready.save", session.user.id);
      return { ok: false, error: "Could not save that. Try again in a minute." };
    }
  });
}

/** Runs one stopped role again, after the person has fixed what stopped it. Can take up to about a minute. */
export async function recheckRunAction(runId: string): Promise<RecheckResult> {
  return monitoredAction("app/app/ready/actions.ts:recheckRunAction", async () => {
    const session = await requireSession();
    const id = z.uuid().safeParse(runId);
    if (!id.success) return { ok: false, error: "That didn't go through. Reload and try again." };
    try {
      const result = await recheckRun(session.user.id, session.user.email, id.data);
      refresh();
      return result;
    } catch (error) {
      const code = reportError(session.user.id, "recheck", error);
      refresh();
      return { ok: false, error: `Something stopped the check (code ${code}). Try again in a minute.` };
    }
  });
}

/**
 * The person's own reason for wanting a role that is waiting on it. The cover letter
 * is rebuilt around it and reviewed again; the role is ready when both documents pass.
 */
export async function addReasonAction(runId: string, why: string): Promise<AddReasonResult> {
  return monitoredAction("app/app/ready/actions.ts:addReasonAction", async () => {
    const session = await requireSession();
    const id = z.uuid().safeParse(runId);
    if (!id.success) return { ok: false, error: "That didn't go through. Reload and try again." };
    try {
      const result = await addReasonToRun(session.user.id, id.data, why);
      refresh();
      return result;
    } catch (error) {
      captureError(error, "ready.save", session.user.id);
      return { ok: false, error: "Could not save that. Try again in a minute." };
    }
  });
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
  return monitoredAction("app/app/ready/actions.ts:dismissRunAction", async () => {
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
      captureError(error, "ready.rule", userId);
      return { ok: false, error: "Could not save that rule. Try again." };
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
  });
}

export async function removeRuleAction(raw: string): Promise<void> {
  return monitoredAction("app/app/ready/actions.ts:removeRuleAction", async () => {
    const session = await requireSession();
    await removeRule(session.user.id, z.string().min(1).max(200).parse(raw));
    refresh();
  });
}
