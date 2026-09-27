import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, dbReady, schema } from "@/lib/db";

if (process.env.VERCEL && !process.env.BETTER_AUTH_SECRET?.trim()) {
  throw new Error("BETTER_AUTH_SECRET is required on Vercel to keep account sessions secure.");
}

export const auth = betterAuth({
  appName: "Proofline",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  // nextCookies must stay last so server actions can set session cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

/** Session for the current request, or null. */
export async function getSession(): Promise<Session | null> {
  const requestHeaders = await headers();
  await dbReady;
  return auth.api.getSession({ headers: requestHeaders });
}

/** Session for the current request; sends signed-out visitors to the login page. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
