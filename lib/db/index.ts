import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One database handle for the whole server.
 *
 * - With DATABASE_URL set (Supabase, Neon, any Postgres): postgres-js.
 * - Without it: PGlite, real Postgres running in-process, stored in .data/pglite.
 *   Free, no account, and the same schema and migrations as production.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

type DbState = { db: Db; ready: Promise<void> };

const MIGRATIONS = path.join(process.cwd(), "drizzle");

function create(): DbState {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { prepare: false });
    const db = drizzlePostgres(client, { schema });
    return { db, ready: migratePostgres(db, { migrationsFolder: MIGRATIONS }) };
  }
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  return { db, ready: migratePglite(db, { migrationsFolder: MIGRATIONS }) };
}

// Survive hot reloads in development: a second PGlite instance on the same folder would corrupt it.
const globalForDb = globalThis as unknown as { __prooflineDb?: DbState };
const state = (globalForDb.__prooflineDb ??= create());
// A failed start (bad URL, locked folder) shouldn't stick across hot reloads.
state.ready.catch(() => {
  if (globalForDb.__prooflineDb === state) globalForDb.__prooflineDb = undefined;
});

export const db = state.db;

/** Resolves once migrations have run. Await before the first query in a request. */
export const dbReady = state.ready;

export { schema };
