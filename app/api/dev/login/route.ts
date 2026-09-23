import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, dbReady, schema } from "@/lib/db";

/**
 * Development only: signs in a synthetic test student so signed-in screens can be
 * exercised without typing credentials into a form. Returns 404 anywhere else.
 */
const DEV_EMAIL = "dev.student@example.com";
const DEV_PASSWORD = process.env.DEV_LOGIN_PASSWORD ?? "proofline-dev-only";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (process.env.NODE_ENV !== "development" || !local) {
    return new NextResponse("Not found", { status: 404 });
  }

  await dbReady;
  const existing = await db.query.user.findFirst({ where: eq(schema.user.email, DEV_EMAIL) });
  if (!existing) {
    await auth.api.signUpEmail({ body: { email: DEV_EMAIL, password: DEV_PASSWORD, name: "Dev Student" } });
  }

  const signIn = await auth.api.signInEmail({
    body: { email: DEV_EMAIL, password: DEV_PASSWORD },
    asResponse: true,
  });

  const next = url.searchParams.get("next") ?? "/app";
  const response = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/app", url));
  for (const cookie of signIn.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  return response;
}
