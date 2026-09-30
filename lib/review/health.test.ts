import { afterEach, describe, expect, it, vi } from "vitest";
import { reserveModelCredits } from "@/lib/llm/quota";
import { checkAiHealth } from "./health";

vi.mock("@/lib/llm/quota", () => ({ reserveModelCredits: vi.fn(), ModelQuotaError: class extends Error {} }));
vi.mock("@/lib/llm/log", () => ({ logLlmCall: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const reply = (payload: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), { status: 200 });

describe("AI health check", () => {
  it("sends made-up data through both real review calls without charging an account", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "synthetic-key");
    vi.stubEnv("PROOFLINE_REVIEW_BASE_URL", "https://review.example.invalid");
    const fetch = vi.fn(async (_url: string, init: RequestInit) =>
      String(init.body).includes("last reviewer") ? reply({ verdict: "PASS", issues: [] }) : reply({ text: "Caught 3 billing errors in one month by reconciling 40 patient payments a day using an Excel tracker I built", clarification: "" }),
    );
    vi.stubGlobal("fetch", fetch);
    const health = await checkAiHealth();
    expect(health.review.ok).toBe(true);
    expect(health.wording.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reserveModelCredits).not.toHaveBeenCalled();
    expect(JSON.stringify(fetch.mock.calls)).toContain("Sample Clinic");
  });

  it("reports a billing failure on both calls instead of throwing", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "synthetic-key");
    vi.stubEnv("PROOFLINE_REVIEW_BASE_URL", "https://review.example.invalid");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("prepay balance is $0", { status: 402 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const health = await checkAiHealth();
    expect(health.review.ok).toBe(false);
    expect(health.wording.ok).toBe(false);
  });

  it("says the key is missing without calling anything", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const health = await checkAiHealth();
    expect(health.configured).toBe(false);
    expect(health.review.detail).toContain("PROOFLINE_REVIEW_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });
});
