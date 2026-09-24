import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { eq } from "drizzle-orm";
import { authenticateToken } from "@/lib/agent/tokens";
import { runTool, TOOLS } from "@/lib/agent/tools";
import { db, dbReady, schema } from "@/lib/db";
import { site } from "@/lib/site";

/**
 * Proofline over MCP, so a student can use their own Claude, ChatGPT, or Gemini.
 * Authenticated with a personal access token from Settings. Stateless: every
 * request gets a fresh server bound to the token's owner, and the same tool
 * layer (and rules) as Proofline's own agent.
 */

export const dynamic = "force-dynamic";

const INSTRUCTIONS = `${site.name} holds a student's verified career history, job matches, resumes, and application tracker.

Rules you must follow:
- Only facts with state "confirmed" are true claims. Never put an unconfirmed or invented detail in anything you write for the student.
- When the student tells you something new about themselves, save it with propose_fact or save_story_note. It stays unconfirmed until they confirm it in ${site.name}.
- Never invent numbers, results, tools, or reasons for wanting a job. Ask the student instead.
- ${site.name} drafts; the student submits applications and sends emails themselves.`;

function unauthorized() {
  return Response.json(
    { error: "Missing or invalid token. Create one in Proofline under Settings, then send it as \"Authorization: Bearer <token>\"." },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="proofline"' } },
  );
}

async function handle(request: Request): Promise<Response> {
  await dbReady;
  const auth = await authenticateToken(request.headers.get("authorization"));
  if (!auth) return unauthorized();
  const user = await db.query.user.findFirst({ where: eq(schema.user.id, auth.userId), columns: { email: true } });
  if (!user) return unauthorized();

  const server = new McpServer({ name: "proofline", title: site.name, version: "1.0.0" }, { instructions: INSTRUCTIONS });
  const ctx = { userId: auth.userId, email: user.email, client: auth.name };
  for (const t of TOOLS) {
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.input,
        annotations: { title: t.title, readOnlyHint: t.readOnly, destructiveHint: false, idempotentHint: t.readOnly, openWorldHint: t.name === "search_jobs" },
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await runTool(t.name, args, ctx);
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Something went wrong.";
          return { isError: true, content: [{ type: "text" as const, text: message }] };
        }
      },
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
