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
  // ?fresh=1 signs in a brand-new student, to walk the first-run coach from an empty profile.
  const fresh = url.searchParams.get("fresh") === "1";
  const email = fresh ? `dev.new.${Date.now()}@example.com` : DEV_EMAIL;
  const existing = fresh ? null : await db.query.user.findFirst({ where: eq(schema.user.email, email) });
  if (!existing) {
    await auth.api.signUpEmail({ body: { email, password: DEV_PASSWORD, name: fresh ? "Sam Rivera" : "Dev Student" } });
  }

  const signIn = await auth.api.signInEmail({
    body: { email, password: DEV_PASSWORD },
    asResponse: true,
  });

  const next = url.searchParams.get("next") ?? "/app";
  const response = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/app", url));
  for (const cookie of signIn.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  return response;
}
