import { randomInt } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logEvent } from "./events";
import { captureError } from "@/lib/monitoring/errors";

/**
 * What happens when the loop throws.
 *
 * The person is shown a short code and a plain sentence, never the error. The real
 * error (message, cause, stack) goes to the server log under `loop.failed` with the
 * same code, the person's id, and the time, so a tester who reads the code out is
 * enough to find it: `vercel logs --query ERR-8F3K2`. A run that stopped as a whole is
 * also kept as an event, so the Ready page can keep showing it until the person
 * dismisses it or a later run completes.
 */

// No 0, 1, I, L, or O: the code is read aloud and typed back.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function diagnosticCode(): string {
  return `ERR-${Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
}

/** Where the error was caught. "run" and "morning" are whole runs; "role" and "recheck" are one role. */
export type FailureScope = "run" | "morning" | "recheck" | "role";

export type RunFailure = { code: string; at: string; scope: "run" | "morning" };

function describe(error: unknown) {
  if (!(error instanceof Error)) return { name: "NonError", message: String(error).slice(0, 500) };
  const cause = error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message, code: (error.cause as { code?: unknown }).code } : undefined;
  return { name: error.name, message: error.message.slice(0, 500), cause, stack: error.stack };
}

/** Logs the real error with a fresh code and returns the code. Never throws. */
export function reportError(userId: string, scope: FailureScope, error: unknown, now: Date = new Date()): string {
  const code = diagnosticCode();
  captureError(error, `loop.${scope}`, userId, now);
  try {
    console.error("loop.failed", JSON.stringify({ code, userId, scope, at: now.toISOString(), ...describe(error) }));
  } catch {
    console.error("loop.failed", code, userId, scope);
  }
  return code;
}

/**
 * A whole run that stopped: logs it, and keeps it for the Ready page. The error text is
 * stored for the owner (event data is not shown to people) and truncated; the stack stays in the log.
 */
export async function recordRunFailure(userId: string, scope: "run" | "morning", error: unknown, now: Date = new Date()): Promise<RunFailure> {
  const code = reportError(userId, scope, error, now);
  const at = now.toISOString();
  try {
    const { name, message } = describe(error);
    await logEvent(userId, "loop_failed", { code, at, scope, error: `${name}: ${message}` });
  } catch (persist) {
    // The database may be the thing that is down. The log line above is still there.
    console.error("loop.failed.unsaved", JSON.stringify({ code, userId, message: persist instanceof Error ? persist.message : String(persist) }));
  }
  return { code, at, scope };
}

/**
 * The failure the Ready page still owes the person: the newest of failed, dismissed,
 * and finished decides. A finished run or a dismissal after a failure clears it.
 */
export async function lastRunFailure(userId: string): Promise<RunFailure | null> {
  const [latest] = await db
    .select({ type: schema.agentEvent.type, data: schema.agentEvent.data })
    .from(schema.agentEvent)
    .where(and(eq(schema.agentEvent.userId, userId), inArray(schema.agentEvent.type, ["loop_failed", "loop_failure_dismissed", "loop_finished"])))
    .orderBy(desc(schema.agentEvent.createdAt))
    .limit(1);
  if (latest?.type !== "loop_failed") return null;
  const data = latest.data as { code?: unknown; at?: unknown; scope?: unknown };
  if (typeof data.code !== "string" || typeof data.at !== "string") return null;
  return { code: data.code, at: data.at, scope: data.scope === "morning" ? "morning" : "run" };
}

/** Clears the failure card: the person dismissed it, or a later run got through. Does nothing when there is none. */
export async function clearRunFailure(userId: string, how: "dismissed" | "later_run"): Promise<void> {
  try {
    const failure = await lastRunFailure(userId);
    if (failure) await logEvent(userId, "loop_failure_dismissed", { code: failure.code, how });
  } catch {
    // The card staying one more visit is better than a run that reports an error it did not have.
  }
}
