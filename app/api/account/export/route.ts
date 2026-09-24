import { getSession } from "@/lib/auth";
import { exportAccount } from "@/lib/account/data";

/** Everything Proofline stores about the signed-in person, as one JSON file. */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Sign in first.", { status: 401 });
  const data = await exportAccount(session.user.id);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="proofline-data-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
