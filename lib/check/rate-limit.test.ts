import { describe, expect, it } from "vitest";
import { allowCheck, CHECK_LIMIT, clientKey, rateLimiter } from "./rate-limit";

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

describe("rate limiter", () => {
  it("keeps separate counts per limiter and per key", () => {
    const allow = rateLimiter({ count: 2, windowMs: 1000 });
    expect([allow("a", 0), allow("a", 1), allow("a", 2)]).toEqual([true, true, false]);
    expect(allow("b", 3)).toBe(true);
    expect(rateLimiter({ count: 1, windowMs: 1000 })("a", 4)).toBe(true);
    expect(allow("a", 1001)).toBe(true);
  });
});
