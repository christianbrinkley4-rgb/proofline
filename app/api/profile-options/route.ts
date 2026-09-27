import { NextResponse } from "next/server";
import { searchProfileOptions, type ProfileOptionKind } from "@/lib/catalog/profile-options";

const KINDS = new Set<ProfileOptionKind>(["roles", "schools", "degrees", "fields"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as ProfileOptionKind | null;
  if (!kind || !KINDS.has(kind)) return NextResponse.json({ error: "Unknown search kind" }, { status: 400 });
  const query = (url.searchParams.get("q") ?? "").slice(0, 80);
  return NextResponse.json({ options: searchProfileOptions(kind, query) }, { headers: { "cache-control": "public, max-age=300" } });
}
