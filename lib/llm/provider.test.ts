import { afterEach, describe, expect, it, vi } from "vitest";
import { getLlm, llmStatus } from "./provider";

afterEach(() => vi.unstubAllEnvs());

describe("rules-only beta mode", () => {
  it("disables external model calls even if a provider key exists", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-never-used");
    vi.stubEnv("PROOFLINE_AI_MODE", "rules");
    expect(getLlm()).toBeNull();
    expect(llmStatus()).toMatchObject({ mode: "offline", model: null });
  });
});