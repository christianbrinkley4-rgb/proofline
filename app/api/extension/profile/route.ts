import { autofillProfile, extensionUser, unauthorized } from "@/lib/extension/service";

export const dynamic = "force-dynamic";

/** The basics the extension may put into an application form, for the person to check. */
export async function GET(request: Request) {
  const user = await extensionUser(request);
  if (!user) return unauthorized();
  return Response.json({ ok: true, profile: await autofillProfile(user.userId, user.email) }, { headers: { "Cache-Control": "no-store" } });
}
