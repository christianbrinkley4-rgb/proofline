import { afterEach, describe, expect, it, vi } from "vitest";
import { recallParts, RECALL_REVIEW_PROMPT, reviewRecallWording, validateRecallWording } from "./recall";

vi.mock("@/lib/llm/quota", () => ({ reserveModelCredits: vi.fn(), ModelQuotaError: class extends Error {} }));
vi.mock("@/lib/llm/log", () => ({ logLlmCall: vi.fn() }));
const parts = { action: "Developed marketing strategies to compete with other agents who sell insurance", measure: "booked 50 percent more appointments", method: "my automation system I designed", result: "" };
const finished = "Booked 50 percent more appointments by developing insurance marketing strategies using an automation system I designed";
const modelResponse = (text: string, clarification = "") => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text, clarification }) }] } }] }), { status: 200 });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("whole-sentence recall wording review", () => {
  it("reads every field, rereads the completed sentence, and protects contributions in the prompt", () => {
    expect(RECALL_REVIEW_PROMPT).toContain("A result entered in measure is still a result");
    expect(RECALL_REVIEW_PROMPT).toContain("may be empty: then leave that part out");
    expect(RECALL_REVIEW_PROMPT).toContain("REREAD the complete sentence");
    expect(RECALL_REVIEW_PROMPT).toContain("Supporting or contributing work must stay supporting or contributing work");
  });
  it("uses only the current card's answers with the existing review service", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "synthetic-key");
    vi.stubEnv("PROOFLINE_REVIEW_BASE_URL", "https://review.example.invalid");
    const fetch = vi.fn().mockResolvedValue(modelResponse(finished));
    vi.stubGlobal("fetch", fetch);
    const review = await reviewRecallWording("synthetic-user", parts);
    expect(review).toMatchObject({ ok: true, text: finished, method: "model" });
    const [url, request] = fetch.mock.calls[0];
    expect(url).toContain("https://review.example.invalid/v1beta/models/");
    const body = JSON.parse(request.body);
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual(parts);
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });
  it("keeps numeric meaning while allowing percent formatting", () => {
    expect(validateRecallWording(parts, finished.replace("50 percent", "50%"))).toContain("50%");
    for (const text of [finished.replace("50 percent", "60 percent"), finished.replace("50 percent", "50"), finished.replace("50 percent ", ""), finished + " over 3 months"]) expect(() => validateRecallWording(parts, text)).toThrow(/number/);
    const currency = { action: "Raised funds", measure: "$1,250", method: "a fundraiser", result: "" };
    expect(() => validateRecallWording(currency, "Raised 1,250 in funds through a fundraiser")).toThrow(/number/);
  });
  it("blocks reversed results, stripped estimates, and upgraded supporting work", () => {
    expect(() => validateRecallWording(parts, finished.replace("more", "fewer"))).toThrow(/direction/);
    const approximate = { ...parts, measure: "booked about 50 percent more appointments" };
    expect(() => validateRecallWording(approximate, finished)).toThrow(/estimate/);
    const support = { action: "Supported the marketing team", measure: "weekly", method: "preparing reports", result: "" };
    expect(() => validateRecallWording(support, "Led the marketing team weekly by preparing reports")).toThrow(/supporting/);
  });
  it("keeps timeframes while allowing natural frequency wording", () => {
    const weekly = { action: "Reviewed forms", measure: "30 each week", method: "a checklist", result: "" };
    expect(validateRecallWording(weekly, "Reviewed 30 forms weekly using a checklist")).toContain("weekly");
    expect(() => validateRecallWording(weekly, "Reviewed 30 forms each month using a checklist")).toThrow(/timeframe/);
    expect(() => validateRecallWording(weekly, "Reviewed 30 forms using a checklist")).toThrow(/timeframe/);
    expect(() => validateRecallWording({ ...weekly, action: "I support the records team" }, "Led the records team weekly by reviewing 30 forms using a checklist")).toThrow(/supporting/);
  });
  it("blocks filler, placeholders, weak openers, multiline text, and long output", () => {
    for (const text of [finished + " with synergy", finished + " [tool]", "Helped with " + finished, finished + "\nAdded something", finished + " word".repeat(80)]) expect(() => validateRecallWording(parts, text)).toThrow(/another review/);
  });
  it("asks for clarification without creating a candidate", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "synthetic-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelResponse("", "What does the 50 percent measure?")));
    expect(await reviewRecallWording("synthetic-user", parts)).toEqual({ ok: false, error: "What does the 50 percent measure?" });
  });
  it("distinguishes rejected wording from service outages without accepting either", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "synthetic-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn().mockResolvedValueOnce(modelResponse(finished.replace("50", "90"))).mockResolvedValueOnce(new Response("provider details", { status: 401 })).mockRejectedValueOnce(new Error("timeout"));
    vi.stubGlobal("fetch", fetch);
    const unsafe = await reviewRecallWording("synthetic-user", parts);
    expect(unsafe).toMatchObject({ ok: false, error: expect.stringContaining("supplied number") });
    expect(unsafe).not.toHaveProperty("fallbackAvailable", true);
    for (let i = 0; i < 2; i++) expect(await reviewRecallWording("synthetic-user", parts)).toMatchObject({ ok: false, fallbackAvailable: true, error: expect.stringContaining("unavailable") });
  });
  it("recognizes the production 402 and permits only an explicit basic review", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "synthetic-key");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn().mockResolvedValue(new Response("private provider billing details", { status: 402 }));
    vi.stubGlobal("fetch", fetch);
    expect(await reviewRecallWording("synthetic-user", parts)).toMatchObject({ ok: false, fallbackAvailable: true, error: expect.stringContaining("Your answers are unchanged") });
    expect(log).toHaveBeenCalledWith("[recall.wording] provider HTTP 402");
    const { reserveModelCredits } = await import("@/lib/llm/quota");
    vi.mocked(reserveModelCredits).mockClear();
    const basic = await reviewRecallWording("synthetic-user", parts, "rules");
    expect(basic).toMatchObject({ ok: true, method: "rules", message: expect.stringContaining("AI has not reviewed") });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reserveModelCredits).not.toHaveBeenCalled();
    expect(basic.ok && basic.text).toContain("50 percent more appointments");
  });
  it("still rejects incomplete output and clarification without offering an outage fallback", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "synthetic-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [] }))).mockResolvedValueOnce(modelResponse("", "What did the percentage measure?"));
    vi.stubGlobal("fetch", fetch);
    for (let i = 0; i < 2; i++) {
      const review = await reviewRecallWording("synthetic-user", parts);
      expect(review.ok).toBe(false);
      expect(review).not.toHaveProperty("fallbackAvailable", true);
    }
  });
  it("labels the local-only fallback and makes no external call", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const result = await reviewRecallWording("synthetic-user", { action: "Reviewed forms", measure: "30 per week", method: "checking missing details", result: "" });
    expect(result).toMatchObject({ ok: true, method: "rules", message: expect.stringContaining("Basic wording check only") });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("validates all raw parts without inventing missing details", () => {
    expect(recallParts(" Reviewed forms ", { measure: "30 per week", method: "checklist", result: "" }).action).toBe("Reviewed forms");
    expect(() => recallParts(parts.action, { ...parts, measure: "[count]" })).toThrow(/brackets/);
    expect(() => recallParts(parts.action, { ...parts, measure: "x".repeat(81) })).toThrow(/Shorten/);
    expect(() => recallParts("  ", { ...parts })).toThrow(/Describe what you did/);
  });
  it("accepts a line with no number or method, and adds neither", () => {
    const bare = recallParts("Explained insurance policies to clients", { measure: "", method: "", result: "" });
    expect(bare).toEqual({ action: "Explained insurance policies to clients", measure: "", method: "", result: "" });
    expect(() => validateRecallWording(bare, "Explained insurance policies to 40 clients")).toThrow(/number/);
    expect(validateRecallWording(bare, "Explained insurance policies to clients")).toBe("Explained insurance policies to clients");
  });
});
