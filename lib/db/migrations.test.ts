import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, dbReady } from "./index";

describe("database", () => {
  it("applies every migration to an empty in-memory database", async () => {
    await dbReady;
    const tables = await db.execute<{ table_name: string }>(sql`select table_name from information_schema.tables where table_schema = 'public'`);
    const names = (tables as unknown as { rows: Array<{ table_name: string }> }).rows.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(["user", "fact", "job", "resume", "application", "application_packet", "agent_event"]));
  }, 60_000);

  it("never opens the local dev database from a test run", () => {
    // The dev folder may exist from `npm run dev`; what matters is that this process didn't lock it.
    const lock = path.join(process.cwd(), ".data", "pglite.lock");
    if (existsSync(lock)) {
      expect(Number(readFileSync(lock, "utf8"))).not.toBe(process.pid);
    }
  });
});
