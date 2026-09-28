import { eq } from "drizzle-orm";
import { authenticateToken } from "@/lib/agent/tokens";
import { db, dbReady, schema } from "@/lib/db";
import { getProfile } from "@/lib/kb/profile";
import { formatMonth } from "@/lib/resume/parse/dates";
import { moveApplication, trackJob } from "@/lib/tracker/service";

/**
 * The browser extension's side of Proofline. It authenticates with a personal
 * access token made on the Connect page, reads only the basics a form asks for,
 * saves postings, and records an application the person says they submitted.
 * It never submits anything itself.
 */

export const EXTENSION_TOKEN_NAME = "Browser extension";

export async function extensionUser(request: Request): Promise<{ userId: string; email: string } | null> {
  await dbReady;
  const auth = await authenticateToken(request.headers.get("authorization"));
  if (!auth) return null;
  const user = await db.query.user.findFirst({ where: eq(schema.user.id, auth.userId), columns: { email: true } });
  return user ? { userId: auth.userId, email: user.email } : null;
}

export function unauthorized() {
  return Response.json({ ok: false, error: "Not connected. Open the Proofline extension and choose Connect." }, { status: 401 });
}

/** What an application form asks for, from the person's own profile. Empty strings are left blank on the form. */
export type AutofillProfile = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  linkedin: string;
  website: string;
  school: string;
  degree: string;
  major: string;
  graduation: string;
  gpa: string;
};

export async function autofillProfile(userId: string, email: string): Promise<AutofillProfile> {
  const p = await getProfile(userId);
  const fullName = p?.fullName?.trim() ?? "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    fullName,
    firstName: parts[0] ?? "",
    lastName: parts.length > 1 ? parts[parts.length - 1] : "",
    email,
    phone: p?.phone ?? "",
    city: p?.city ?? "",
    region: p?.region ?? "",
    linkedin: p?.linkedinUrl ?? "",
    website: p?.portfolioUrl ?? "",
    school: p?.school ?? "",
    degree: p?.degree ?? "",
    major: p?.major ?? "",
    graduation: p?.gradDate ? formatMonth(p.gradDate) : "",
    gpa: p?.gpa != null ? String(p.gpa) : "",
  };
}

/** Records that the person submitted the application. A tracked job that was only saved moves to Applied. */
export async function markApplied(userId: string, jobId: string) {
  const app = await trackJob(userId, jobId, { stage: "applied" });
  if (app.stage === "saved") await moveApplication(userId, app.id, "applied");
  return app.id;
}
