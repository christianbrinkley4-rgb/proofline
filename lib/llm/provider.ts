import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { logLlmCall } from "./log";
import { reserveModelCredits } from "./quota";

/**
 * The only door to a language model. Features ask for typed output through
 * `generateObject`; they never import a vendor SDK or hold a prompt string.
 *
 * Every feature must also work without a model (the "offline" path), so
 * `getLlm()` returns null when no provider is configured and callers fall back
 * to their rules-based implementation.
 */

export type LlmInput = string | Anthropic.Beta.BetaContentBlockParam[];

export type ObjectTask<T> = {
  /** Short name for logs and metrics, e.g. "resume.parse". */
  purpose: string;
  /** Account charged for this provider call; required in production. */
  userId?: string;
  /** Prompt file version, e.g. "resume-parse.v1". */
  promptVersion: string;
  system: string;
  input: LlmInput;
  schema: z.ZodType<T>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
};

export interface LlmProvider {
  readonly id: "anthropic";
  readonly model: string;
  generateObject<T>(task: ObjectTask<T>): Promise<T>;
}

export class LlmRefusalError extends Error {
  constructor(public readonly category: string | null) {
    super(`Model declined the request${category ? ` (${category})` : ""}`);
  }
}

export class LlmOutputError extends Error {}

/** Default model when a key is configured. One env var switches it. */
export const DEFAULT_MODEL = "claude-opus-5";

class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic" as const;
  readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    // Pin the public API. Without this the SDK would inherit ANTHROPIC_BASE_URL from
    // the host environment (developer tooling sets it), sending student data elsewhere.
    this.client = new Anthropic({ apiKey, baseURL: process.env.PROOFLINE_ANTHROPIC_BASE_URL ?? "https://api.anthropic.com" });
  }

  async generateObject<T>(task: ObjectTask<T>): Promise<T> {
    const started = Date.now();
    if (!task.userId && process.env.NODE_ENV === "production") throw new Error("Model calls require an account.");
    if (task.userId) await reserveModelCredits(task.userId, task.purpose);
    try {
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: Math.min(task.maxTokens ?? 8192, 8192),
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: task.effort ?? "medium", format: betaZodOutputFormat(task.schema) },
        system: [{ type: "text", text: task.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: task.input }],
      });

      if (response.stop_reason === "refusal") {
        throw new LlmRefusalError(response.stop_details?.category ?? null);
      }
      if (response.parsed_output == null) {
        throw new LlmOutputError(`No parseable output (stop_reason: ${response.stop_reason})`);
      }
      await logLlmCall({
        purpose: task.purpose,
        promptVersion: task.promptVersion,
        model: response.model,
        ms: Date.now() - started,
        input: task.input,
        output: response.parsed_output,
        usage: response.usage,
      });
      return response.parsed_output as T;
    } catch (error) {
      await logLlmCall({
        purpose: task.purpose,
        promptVersion: task.promptVersion,
        model: this.model,
        ms: Date.now() - started,
        input: task.input,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

let cached: LlmProvider | null | undefined;

/** The configured provider, or null in offline mode. */
export function getLlm(): LlmProvider | null {
  // The first beta deliberately uses the independent rules-based engine.
  if (process.env.PROOFLINE_AI_MODE === "rules") return null;
  if (cached !== undefined) return cached;
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  cached = key ? new AnthropicProvider(key, process.env.LLM_MODEL?.trim() || DEFAULT_MODEL) : null;
  return cached;
}

/** The SDK client and model for multi-turn features (chat), or null in offline mode. */
export function anthropicClient(): { client: Anthropic; model: string } | null {
  const llm = getLlm();
  return llm instanceof AnthropicProvider ? { client: llm.client, model: llm.model } : null;
}

/**
 * Model for in-app agent chat. Prefer `LLM_CHAT_MODEL` (faster) when set;
 * drafting and other features keep using `LLM_MODEL` / Opus via `getLlm()`.
 */
export function chatModel(fallback: string): string {
  return process.env.LLM_CHAT_MODEL?.trim() || fallback;
}

export function llmStatus(): { mode: "anthropic" | "offline"; model: string | null } {
  const llm = getLlm();
  return llm ? { mode: llm.id, model: llm.model } : { mode: "offline", model: null };
}
