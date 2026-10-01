import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/lib/db";
import { clearRunFailure, diagnosticCode, lastRunFailure, recordRunFailure, reportError } from "./failure";
import { logEvent } from "./events";

const CODE = /^ERR-[2-9A-HJKMNP-Z]{5}$/;

async function person(id: string) {
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com` }).onConflictDoNothing();
}

describe("the diagnostic code", () => {
  it("is short, readable aloud, and different each time", () => {
    const codes = Array.from({ length: 200 }, diagnosticCode);
    expect(codes.every((c) => CODE.test(c))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(190);
  });
});

describe("reporting a failure", () => {
  beforeAll(async () => {
    await dbReady;
  }, 60_000);

  it("logs the real error with the person's id, the time, and the code, and returns only the code", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Failed query: select secret from agent_run", { cause: Object.assign(new Error("connection reset"), { code: "ECONNRESET" }) });
    const at = new Date("2026-10-02T09:30:00Z");
    const code = reportError("user-1", "run", error, at);
    expect(code).toMatch(CODE);
    const [tag, body] = logged.mock.calls[0];
    expect(tag).toBe("loop.failed");
    expect(JSON.parse(String(body))).toMatchObject({
      code,
      userId: "user-1",
      scope: "run",
      at: "2026-10-02T09:30:00.000Z",
      name: "Error",
      message: "Failed query: select secret from agent_run",
      cause: { message: "connection reset", code: "ECONNRESET" },
    });
    expect(JSON.parse(String(body)).stack).toContain("Failed query");
    logged.mockRestore();
  });

  it("keeps a run that stopped until it is dismissed, and a later failure shows again", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await person("fail-keep");
    expect(await lastRunFailure("fail-keep")).toBeNull();
    const failure = await recordRunFailure("fail-keep", "run", new Error("boom"), new Date("2026-10-02T09:30:00Z"));
    expect(await lastRunFailure("fail-keep")).toEqual({ code: failure.code, at: "2026-10-02T09:30:00.000Z", scope: "run" });
    await clearRunFailure("fail-keep", "dismissed");
    expect(await lastRunFailure("fail-keep")).toBeNull();
    const again = await recordRunFailure("fail-keep", "morning", new Error("boom again"));
    expect(await lastRunFailure("fail-keep")).toMatchObject({ code: again.code, scope: "morning" });
    logged.mockRestore();
  });

  it("clears when a later run gets through, and does nothing when there is nothing to clear", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await person("fail-later");
    await clearRunFailure("fail-later", "later_run");
    expect(await db.query.agentEvent.findMany({ where: eq(schema.agentEvent.userId, "fail-later") })).toHaveLength(0);
    await recordRunFailure("fail-later", "run", new Error("boom"));
    await logEvent("fail-later", "loop_finished", { ready: 0 });
    expect(await lastRunFailure("fail-later")).toBeNull();
    logged.mockRestore();
  });

  it("keeps the stack out of the saved record, and does not throw when the database cannot take it", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    // No such user: the event insert fails on its foreign key, as it would if the database were down.
    const failure = await recordRunFailure("fail-nobody", "run", new Error("boom"));
    expect(failure.code).toMatch(CODE);
    expect(logged.mock.calls.map((c) => c[0])).toEqual(["loop.failed", "loop.failed.unsaved"]);
    await person("fail-stack");
    await recordRunFailure("fail-stack", "run", new Error("boom"));
    const [event] = await db.query.agentEvent.findMany({ where: eq(schema.agentEvent.userId, "fail-stack") });
    expect(JSON.stringify(event.data)).not.toContain("    at ");
    logged.mockRestore();
  });
});
