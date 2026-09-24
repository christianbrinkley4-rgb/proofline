import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { runTool, TOOLS, type ToolContext } from "@/lib/agent/tools";
import { CHAT_V1 } from "./prompts/chat.v1";
import { anthropicClient, chatModel } from "./provider";
import { logLlmCall } from "./log";

/**
 * The in-app agent when a model is configured: a streaming tool loop over the
 * same tools an outside AI gets through MCP, so the same rules hold. Tool inputs
 * are validated and every call is logged by `runTool`.
 */

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; title: string }
  | { type: "tool_done"; name: string; ok: boolean }
  | { type: "status"; message: string };

export type ChatTurn = { role: "user" | "assistant"; text: string };

const MAX_STEPS = 8;

/** Tool definitions for the API, from the tool layer's zod shapes. */
export function apiTools(): Anthropic.Beta.BetaTool[] {
  const tools: Anthropic.Beta.BetaTool[] = TOOLS.map((t) => {
    const schema = z.toJSONSchema(z.object(t.input)) as { properties?: Record<string, unknown>; required?: string[] };
    return {
      name: t.name,
      description: t.description,
      input_schema: { type: "object" as const, properties: schema.properties ?? {}, required: schema.required ?? [] },
    };
  });
  // Cache breakpoint on the last tool so the whole tools list stays in the prompt cache.
  if (tools.length) tools[tools.length - 1] = { ...tools[tools.length - 1], cache_control: { type: "ephemeral" } };
  return tools;
}

export async function runChat(
  history: ChatTurn[],
  ctx: ToolContext & { name: string; today: string },
  emit: (event: ChatEvent) => void,
): Promise<{ text: string; tools: Array<{ name: string; ok: boolean }> }> {
  const llm = anthropicClient();
  if (!llm) throw new Error("No model configured.");
  const model = chatModel(llm.model);
  const tools = apiTools();
  const titles = new Map(TOOLS.map((t) => [t.name, t.title]));
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((turn) => ({ role: turn.role, content: turn.text }));
  const used: Array<{ name: string; ok: boolean }> = [];
  let text = "";
  const started = Date.now();
  const toolCtx: ToolContext = {
    userId: ctx.userId,
    email: ctx.email,
    client: ctx.client,
    onStatus: (message) => emit({ type: "status", message }),
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = llm.client.beta.messages.stream({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: [
        { type: "text", text: CHAT_V1.system, cache_control: { type: "ephemeral" } },
        { type: "text", text: `The student's name is ${ctx.name || "unknown"}. Today is ${ctx.today}.` },
      ],
      tools,
      messages,
    });
    stream.on("text", (delta) => {
      text += delta;
      emit({ type: "text", delta });
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      const note = "\n\nI can't help with that one. Try asking about your search, your applications, or your story.";
      text += note;
      emit({ type: "text", delta: note });
      break;
    }
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!calls.length || message.stop_reason !== "tool_use") break;

    messages.push({ role: "assistant", content: message.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      emit({ type: "tool", name: call.name, title: titles.get(call.name) ?? call.name });
      try {
        const result = await runTool(call.name, call.input, toolCtx);
        results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) });
        used.push({ name: call.name, ok: true });
        emit({ type: "tool_done", name: call.name, ok: true });
      } catch (error) {
        const detail = error instanceof z.ZodError ? `Invalid input: ${error.issues.map((i) => i.message).join("; ")}` : error instanceof Error ? error.message : "Tool failed.";
        results.push({ type: "tool_result", tool_use_id: call.id, content: detail, is_error: true });
        used.push({ name: call.name, ok: false });
        emit({ type: "tool_done", name: call.name, ok: false });
      }
    }
    messages.push({ role: "user", content: results });
    if (text && !text.endsWith("\n")) {
      text += "\n\n";
      emit({ type: "text", delta: "\n\n" });
    }
  }

  await logLlmCall({ purpose: "agent.chat", promptVersion: CHAT_V1.version, model, ms: Date.now() - started, input: history.at(-1)?.text ?? "", output: { text, tools: used } });
  return { text: text.trim(), tools: used };
}
