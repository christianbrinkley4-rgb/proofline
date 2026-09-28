import { describe, expect, it } from "vitest";
import { allowCheck, CHECK_LIMIT, clientKey } from "./rate-limit";

describe("public check rate limit", () => {
  it("allows a burst up to the limit, then refuses until the window passes", () => {
    const key = `test-${Math.random()}`;
    const start = 1_000_000;
    for (let i = 0; i < CHECK_LIMIT.count; i++) expect(allowCheck(key, start + i)).toBe(true);
    expect(allowCheck(key, start + CHECK_LIMIT.count)).toBe(false);
    expect(allowCheck(key, start + CHECK_LIMIT.windowMs + CHECK_LIMIT.count)).toBe(true);
  });

  it("keys on the first forwarded address", () => {
    expect(clientKey(new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } }))).toBe("203.0.113.9");
    expect(clientKey(new Request("http://x"))).toBe("unknown");
  });
});
