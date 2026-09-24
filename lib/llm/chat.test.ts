import { afterEach, describe, expect, it, vi } from "vitest";
import { apiTools } from "./chat";
import { chatModel } from "./provider";

describe("apiTools", () => {
  it("marks the last tool for prompt caching", () => {
    const tools = apiTools();
    expect(tools.length).toBeGreaterThan(1);
    expect(tools.at(-1)?.cache_control).toEqual({ type: "ephemeral" });
    expect(tools.slice(0, -1).every((t) => !t.cache_control)).toBe(true);
  });
});

describe("chatModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers LLM_CHAT_MODEL when set", () => {
    vi.stubEnv("LLM_CHAT_MODEL", "claude-haiku");
    expect(chatModel("claude-opus-5")).toBe("claude-haiku");
  });

  it("falls back to the drafting model", () => {
    vi.stubEnv("LLM_CHAT_MODEL", "");
    expect(chatModel("claude-opus-5")).toBe("claude-opus-5");
  });
});
