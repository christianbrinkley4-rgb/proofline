import { NextResponse } from "next/server";
import { dbReady } from "@/lib/db";
import { refreshFeed } from "@/lib/jobs/feed/refresh";

/** Development only: fills the local Find jobs pool from the live employer boards. Returns 404 anywhere else. */
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (process.env.NODE_ENV !== "development" || !local) return new NextResponse("Not found", { status: 404 });
  await dbReady;
  return NextResponse.json(await refreshFeed());
}
