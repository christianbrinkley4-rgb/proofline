import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { lastRunFailure } from "@/lib/agent/failure";

const run = vi.hoisted(() => ({ runLoop: vi.fn(), recheckRun: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireSession: async () => ({ user: { id: "action-user", email: "action@example.com" } }) }));
vi.mock("@/lib/agent/loop", () => run);

import { dismissRunFailureAction, recheckRunAction, runLoopAction } from "./actions";

const SQL_ERROR = new Error('Failed query: select count(*)::int from "agent_run" where "user_id" = $1 params: action-user');

describe("the Ready page actions", () => {
  beforeAll(async () => {
    await dbReady;
    await db.insert(schema.user).values({ id: "action-user", name: "Action", email: "action@example.com" }).onConflictDoNothing();
  }, 60_000);
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows a code, not the error, when a run stops, and the same code is in the log and on the page", async () => {
    run.runLoop.mockRejectedValueOnce(SQL_ERROR);
    const result = await runLoopAction();
    expect(result).toMatchObject({ ok: false });
    const error = (result as { error: string }).error;
    expect(error).toMatch(/^Something stopped the run \(code ERR-[2-9A-HJKMNP-Z]{5}\)\. Whatever finished is saved below; try again in a minute\.$/);
    expect(error).not.toMatch(/query|select|agent_run|params/i);
    const code = error.match(/ERR-[2-9A-HJKMNP-Z]{5}/)![0];
    const loggedLine = vi.mocked(console.error).mock.calls.map((c) => String(c[1])).find((l) => l.includes(code));
    expect(JSON.parse(loggedLine!)).toMatchObject({ code, userId: "action-user", message: SQL_ERROR.message });
    expect(await lastRunFailure("action-user")).toMatchObject({ code, scope: "run" });
  });

  it("keeps the notice until it is dismissed", async () => {
    expect(await lastRunFailure("action-user")).not.toBeNull();
    await dismissRunFailureAction();
    expect(await lastRunFailure("action-user")).toBeNull();
  });

  it("clears an earlier notice once a run gets through", async () => {
    run.runLoop.mockRejectedValueOnce(new Error("boom"));
    await runLoopAction();
    expect(await lastRunFailure("action-user")).not.toBeNull();
    const summary = { blocked: null, looked: 0, ready: 0, needsYou: 0, skipped: 0, unconfirmed: 0 };
    run.runLoop.mockResolvedValueOnce(summary);
    expect(await runLoopAction()).toEqual({ ok: true, summary });
    expect(await lastRunFailure("action-user")).toBeNull();
  });

  it("gives a code for a check that stops, and records no run failure for it", async () => {
    await dismissRunFailureAction();
    run.recheckRun.mockRejectedValueOnce(SQL_ERROR);
    const result = await recheckRunAction("3f0c1f0e-5f7a-4f4e-9b0e-1a2b3c4d5e6f");
    expect((result as { error: string }).error).toMatch(/^Something stopped the check \(code ERR-[2-9A-HJKMNP-Z]{5}\)\. Try again in a minute\.$/);
    expect(await lastRunFailure("action-user")).toBeNull();
  });
});
