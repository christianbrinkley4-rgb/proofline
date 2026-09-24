import { getSession } from "@/lib/auth";
import { searchJobs } from "@/lib/jobs/search";
import type { SearchProgress } from "@/lib/jobs/types";

export const maxDuration = 120;

/**
 * Streams the agent's search as Server-Sent Events: what it understood, each
 * source as it's searched, then scored results (partial early, then final).
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Sign in first.", { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return new Response("Tell me what you're looking for.", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SearchProgress | { type: "error"; message: string }) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client closed the stream.
        }
      };
      try {
        const { results } = await searchJobs(session.user.id, query, send, { signal: request.signal });
        send({ type: "results", results });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("job search failed", error);
        send({ type: "error", message: "The search hit a problem. Try again in a moment." });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
