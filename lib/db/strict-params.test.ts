import { beforeAll, describe, expect, it } from "vitest";
import { gt, sql } from "drizzle-orm";
import { db, dbReady, schema } from "@/lib/db";

// The hosted database (postgres-js) cannot take a raw Date inside a sql`` template, and PGlite can. The
// test database refuses it too, so a query that would fail in production fails here.
describe("the test database matches the hosted one on dates", () => {
  beforeAll(async () => {
    await dbReady;
  }, 60_000);

  it("rejects a raw Date inside a sql template", async () => {
    const since = new Date();
    await expect(db.select({ id: schema.agentRun.id }).from(schema.agentRun).where(sql`${schema.agentRun.createdAt} > ${since}`)).rejects.toThrow(/raw Date/);
  });

  it("accepts the same comparison through a column helper, which encodes the date", async () => {
    await expect(db.select({ id: schema.agentRun.id }).from(schema.agentRun).where(gt(schema.agentRun.createdAt, new Date()))).resolves.toEqual([]);
  });
});
