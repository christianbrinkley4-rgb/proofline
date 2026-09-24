import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { BOARDS } from "./registry";
import type { BoardRef } from "./sources/boards";

type SavedJobSeed = Pick<typeof schema.job.$inferSelect, "source" | "sourceId" | "company">;

const BOARD_SOURCES = new Set<BoardRef["source"]>(["greenhouse", "lever", "ashby", "smartrecruiters"]);
const BOARD_ID = /^([A-Za-z0-9][A-Za-z0-9_-]{0,79}):([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/;
export const MAX_DISCOVERED_BOARDS = 12;

/** A saved posting can seed a board only when it came through a supported ATS API. */
export function boardFromSavedJob(job: SavedJobSeed): BoardRef | null {
  if (!BOARD_SOURCES.has(job.source as BoardRef["source"])) return null;
  const match = job.sourceId.match(BOARD_ID);
  if (!match) return null;
  return { source: job.source as BoardRef["source"], slug: match[1], company: job.company };
}

export function uniqueDiscoveredBoards(
  jobs: SavedJobSeed[],
  known: BoardRef[] = BOARDS,
  limit = MAX_DISCOVERED_BOARDS,
): BoardRef[] {
  if (limit <= 0) return [];
  const seen = new Set(known.map((board) => `${board.source}:${board.slug.toLowerCase()}`));
  const out: BoardRef[] = [];
  for (const job of jobs) {
    const board = boardFromSavedJob(job);
    if (!board) continue;
    const key = `${board.source}:${board.slug.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(board);
    if (out.length >= limit) break;
  }
  return out;
}

/** User-scoped, recent saved jobs only. Pasted and generic links remain ineligible. */
export async function discoveredBoardsForUser(userId: string): Promise<BoardRef[]> {
  const saved = await db.query.jobMatch.findMany({
    where: and(eq(schema.jobMatch.userId, userId), eq(schema.jobMatch.status, "saved")),
    orderBy: [desc(schema.jobMatch.updatedAt)],
    columns: { jobId: true },
    limit: 100,
  });
  if (!saved.length) return [];
  const jobs = await db.query.job.findMany({
    where: inArray(schema.job.id, saved.map((match) => match.jobId)),
    columns: { id: true, source: true, sourceId: true, company: true },
  });
  const byId = new Map(jobs.map((job) => [job.id, job]));
  return uniqueDiscoveredBoards(saved.flatMap((match) => {
    const job = byId.get(match.jobId);
    return job ? [job] : [];
  }));
}
