import * as Sentry from "@sentry/nextjs";
import { afterEach, describe, expect, it } from "vitest";
import { captureError } from "./errors";
import { stripPrivateData } from "./options";

afterEach(async () => { await Sentry.close(); });

describe("error reporting", () => {
  it("sends the account ID, operation and timestamp through the SDK transport", async () => {
    const envelopes: unknown[] = [];
    Sentry.init({
      dsn: "https://0123456789abcdef@example.com/1",
      defaultIntegrations: false,
      beforeSend: stripPrivateData,
      transport: () => ({
        send: async (envelope: unknown) => { envelopes.push(envelope); return { statusCode: 200 }; },
        flush: async () => true,
      }),
    });
    const at = new Date("2026-10-02T03:00:00Z");
    captureError(new Error("Synthetic verification failure"), "onboarding.save", "test-student", at);
    await Sentry.flush();
    const serialized = JSON.stringify(envelopes);
    expect(serialized).toContain('"id":"test-student"');
    expect(serialized).toContain('"operation":"onboarding.save"');
    expect(serialized).toContain(at.toISOString());
    expect(serialized).toContain("Synthetic verification failure");
  });

  it("removes form bodies, cookies, headers, query values and contact fields", () => {
    const event = stripPrivateData({
      type: undefined,
      request: { url: "https://proofline.test/app?email=private@example.com", cookies: { session: "secret" }, headers: { authorization: "secret" }, data: { password: "private" }, query_string: "email=private@example.com" },
      user: { id: "student", email: "private@example.com", ip_address: "127.0.0.1" },
      breadcrumbs: [{ message: "private form contents" }],
    });
    expect(event.user).toEqual({ id: "student" });
    expect(event.request).toEqual({ url: "https://proofline.test/app" });
    expect(event.breadcrumbs).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain("private");
  });

  it("does not send an event without initialization", () => {
    expect(() => captureError(new Error("Local failure"), "ready.run", "student")).not.toThrow();
  });
});
