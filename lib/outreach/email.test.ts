import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverMessage } from "./email";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const message = { to: "contact@meridian.test", replyTo: "sam@candidate.test", subject: "Analyst at Meridian", body: "Reviewed message", id: "stable-attempt" };
function configured() { vi.stubEnv("RESEND_API_KEY", "synthetic-test-key"); vi.stubEnv("EMAIL_FROM", "Proofline <mail@proofline.test>"); }
describe("provider receipts", () => {
  it("requires configured sending and never claims a send without it", async () => { vi.stubEnv("RESEND_API_KEY", ""); const call = vi.fn(); vi.stubGlobal("fetch", call); await expect(deliverMessage(message)).rejects.toThrow("not configured"); expect(call).not.toHaveBeenCalled(); });
  it("sends only the reviewed message with reply address and stable idempotency key", async () => {
    configured(); const call = vi.fn(async () => new Response(JSON.stringify({ id: "provider-123" }), { status: 200 })); vi.stubGlobal("fetch", call);
    expect(await deliverMessage(message)).toEqual({ status: "accepted", providerId: "provider-123" });
    const request = call.mock.calls[0] as unknown as [string, RequestInit];
    expect(request[0]).toBe("https://api.resend.com/emails"); expect(request[1].headers).toMatchObject({ "Idempotency-Key": "stable-attempt" });
    expect(JSON.parse(request[1].body as string)).toMatchObject({ to: [message.to], reply_to: message.replyTo, text: message.body, subject: message.subject });
  });
  it.each([400, 401, 429])("does not invent a receipt for HTTP %s", async (status) => { configured(); vi.stubGlobal("fetch", vi.fn(async () => new Response("Rejected", { status }))); expect(await deliverMessage(message)).toEqual({ status: "rejected" }); });
  it.each([500, 503])("treats HTTP %s as unconfirmed rather than encouraging a duplicate", async (status) => { configured(); vi.stubGlobal("fetch", vi.fn(async () => new Response("Error", { status }))); expect(await deliverMessage(message)).toEqual({ status: "unconfirmed" }); });
  it("does not claim success for a timeout or a response without an ID", async () => { configured(); vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); })); expect(await deliverMessage(message)).toEqual({ status: "unconfirmed" }); vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 }))); expect(await deliverMessage(message)).toEqual({ status: "unconfirmed" }); });
});
