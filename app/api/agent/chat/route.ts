import { z } from "zod";
import { getSession } from "@/lib/auth";
import { appendChat, clearChat, listChat } from "@/lib/agent/chat-store";
import { offlineReply } from "@/lib/agent/offline";
import { getProfile } from "@/lib/kb/profile";
import { runChat, type ChatEvent } from "@/lib/llm/chat";
import { anthropicClient } from "@/lib/llm/provider";

/**
 * Chat with the personal agent. Streams newline-delimited JSON events:
 * text deltas, tool starts and finishes, then "done" (or "error").
 * Uses Claude when a key is configured, and the rules-based agent otherwise.
 */

export const dynamic = "force-dynamic";

const Body = z.object({ message: z.string().trim().min(1).max(4000) });
type WireEvent = ChatEvent | { type: "done"; mode: "model" | "offline" } | { type: "error"; message: string };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Sign in first.", { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Write a message first.", { status: 400 });
  const userId = session.user.id;
  const message = parsed.data.message;

  const [history, profile] = await Promise.all([listChat(userId, 20), getProfile(userId)]);
  await appendChat(userId, "user", message);
  const ctx = { userId, email: session.user.email, client: "Proofline" };
  const model = anthropicClient();

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: WireEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        let reply: { text: string; tools: Array<{ name: string; ok: boolean }> };
        if (model) {
          reply = await runChat(
            [...history.map((h) => ({ role: h.role, text: h.text })), { role: "user", text: message }],
            { ...ctx, name: profile?.fullName ?? session.user.name, today: new Date().toISOString().slice(0, 10) },
            send,
          );
        } else {
          reply = await offlineReply(message, ctx);
          for (const t of reply.tools) send({ type: "tool_done", name: t.name, ok: t.ok });
          send({ type: "text", delta: reply.text });
        }
        await appendChat(userId, "assistant", reply.text || "Done.", reply.tools);
        send({ type: "done", mode: model ? "model" : "offline" });
      } catch (error) {
        const text = error instanceof Error && !model ? error.message : "Something went wrong on my side. Please try again.";
        await appendChat(userId, "assistant", text).catch(() => {});
        send({ type: "error", message: text });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return new Response("Sign in first.", { status: 401 });
  await clearChat(session.user.id);
  return new Response(null, { status: 204 });
}
