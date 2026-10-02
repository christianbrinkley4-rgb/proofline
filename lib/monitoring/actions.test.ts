import { describe, expect, it, vi } from "vitest";
const captures = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getSession: async () => ({ user: { id: "student" } }) }));
vi.mock("./errors", () => ({ captureError: captures }));
vi.mock("@sentry/nextjs", () => ({ flush: async () => true }));
vi.mock("next/navigation", () => ({ unstable_rethrow: (error: Error & { digest?: string }) => { if (error.digest === "NEXT_REDIRECT") throw error; } }));
import { monitoredAction } from "./actions";

describe("server action failures", () => {
  it("reports the original failure with the user ID but returns no SQL or stack", async () => {
    const raw = new Error("SELECT private_data FROM account failed with secret parameters");
    await expect(monitoredAction("resume.build", async () => { throw raw; })).rejects.toThrow("Something went wrong. Your saved work is still there. Try again.");
    expect(captures).toHaveBeenCalledWith(raw, "resume.build", "student");
  });
  it("preserves framework redirects", async () => {
    const redirect = Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT" });
    await expect(monitoredAction("onboarding.finish", async () => { throw redirect; })).rejects.toBe(redirect);
  });
  it("keeps expected validation results intact", async () => {
    const validation = { ok: false, error: "Name Excel in your answer." };
    expect(await monitoredAction("resume.answer", async () => validation)).toBe(validation);
  });
});
