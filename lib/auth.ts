import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logEvent } from "@/lib/agent/events";
import { canSignUp, PRIVATE_BETA_CODE, PRIVATE_BETA_MESSAGE } from "@/lib/beta-access";
import { db, dbReady, schema } from "@/lib/db";
import { emailConfigured, sendEmail } from "@/lib/email";
import { savePasswordResetForOwner } from "@/lib/inbox/service";

if (process.env.VERCEL && !process.env.BETTER_AUTH_SECRET?.trim()) {
  throw new Error("BETTER_AUTH_SECRET is required on Vercel to keep account sessions secure.");
}

const privateBeta = () => new APIError("FORBIDDEN", { message: PRIVATE_BETA_MESSAGE, code: PRIVATE_BETA_CODE });

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
    // An hour when the link is emailed; three days when the owner has to forward it by hand.
    resetPasswordTokenExpiresIn: emailConfigured() ? 60 * 60 : 72 * 60 * 60,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      const sent = await sendEmail({
        to: user.email,
        subject: "Reset your Proofline password",
        text: `Someone asked to reset the password for this Proofline account.\n\nChoose a new password here (the link works for one hour):\n${url}\n\nIf that wasn't you, ignore this email and nothing changes.`,
      });
      // No email provider yet: keep the link where the owner can pass it on by hand.
      if (sent !== "sent") await savePasswordResetForOwner(user, url);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  hooks: {
    // Refuse before any account lookup, so the notice never says whether an address has an account.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && !canSignUp((ctx.body as { email?: unknown } | undefined)?.email)) throw privateBeta();
    }),
  },
  databaseHooks: {
    user: {
      create: {
        // Second lock on the same door: no code path creates a user outside the allowlist.
        before: async (user) => {
          if (!canSignUp(user.email)) throw privateBeta();
        },
        after: async (user) => {
          await logEvent(user.id, "signup", {});
        },
      },
    },
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
