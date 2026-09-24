import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
 * - Under tests: an in-memory PGlite, so a test run can never touch the dev database.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

type DbState = { db: Db; ready: Promise<void> };

const MIGRATIONS = path.join(process.cwd(), "drizzle");

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * PGlite is a single-process database: two processes writing the same folder
 * corrupt it. A lock file with our pid makes a second process fail loudly instead.
 */
function lockDataDir(dataDir: string) {
  const lock = `${dataDir}.lock`;
  try {
    const owner = Number(readFileSync(lock, "utf8"));
    if (owner && owner !== process.pid && alive(owner)) {
      throw new Error(
        `Another process (pid ${owner}) is using the local database at ${dataDir}. ` +
          `Stop it first, or set PGLITE_DIR to a different folder for this process. If nothing else is running, delete ${lock}.`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  writeFileSync(lock, String(process.pid));
  const release = () => {
    try {
      if (Number(readFileSync(lock, "utf8")) === process.pid) rmSync(lock);
    } catch {
      // Already gone.
    }
  };
  process.once("exit", release);
}

function create(): DbState {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { prepare: false });
    const db = drizzlePostgres(client, { schema });
    return { db, ready: migratePostgres(db, { migrationsFolder: MIGRATIONS }) };
  }
  // Tests, and `next build` (which loads server modules in several worker processes at once),
  // get a throwaway in-memory database.
  if ((process.env.VITEST || process.env.NEXT_PHASE === "phase-production-build") && !process.env.PGLITE_DIR) {
    const db = drizzlePglite(new PGlite(), { schema });
    return { db, ready: migratePglite(db, { migrationsFolder: MIGRATIONS }) };
  }
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  lockDataDir(dataDir);
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  const ready = migratePglite(db, { migrationsFolder: MIGRATIONS }).catch((error: unknown) => {
    const cause = error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : String(error);
    if (/Aborted/.test(cause)) {
      throw new Error(
        `The local database at ${dataDir} can't be opened; it was probably written by two processes at once. ` +
          `Stop the dev server, move that folder aside (for example to ${dataDir}-broken), and start again to get a fresh database.`,
        { cause: error },
      );
    }
    throw error;
  });
  return { db, ready };
}

// Survive hot reloads in development: a second PGlite instance on the same folder would corrupt it.
const globalForDb = globalThis as unknown as { __prooflineDb?: DbState };

/**
 * Opened on first use, never on import. Next's dev server loads route modules in
 * short-lived helper processes (to read route config); opening the database at
 * import time made each of them a second writer on the same PGlite folder.
 */
function state(): DbState {
  const existing = globalForDb.__prooflineDb;
  if (existing) return existing;
  const created = create();
  globalForDb.__prooflineDb = created;
  // A failed start (bad URL, locked folder) shouldn't stick across hot reloads.
  created.ready.catch(() => {
    if (globalForDb.__prooflineDb === created) globalForDb.__prooflineDb = undefined;
  });
  return created;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, property) {
    const real = state().db as unknown as Record<PropertyKey, unknown>;
    const value = real[property];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

/** Resolves once migrations have run. Await before the first query in a request. */
export const dbReady: PromiseLike<void> = {
  then: (onFulfilled, onRejected) => state().ready.then(onFulfilled, onRejected),
};

export { schema };
