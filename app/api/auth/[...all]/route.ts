import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { dbReady } from "@/lib/db";

const handler = toNextJsHandler(auth);

export async function GET(request: Request) {
  await dbReady;
  return handler.GET(request);
}

export async function POST(request: Request) {
  await dbReady;
  return handler.POST(request);
}
