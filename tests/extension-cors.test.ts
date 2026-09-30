import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

const EXT = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const req = (path: string, init: { method?: string; origin?: string } = {}) =>
  new NextRequest(`https://proofline-beta.vercel.app${path}`, { method: init.method ?? "GET", headers: init.origin ? { origin: init.origin } : {} });

describe("extension API from the extension's own origin", () => {
  it("answers the preflight Chrome sends when site access is limited", () => {
    const res = proxy(req("/api/extension/score", { method: "OPTIONS", origin: EXT }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
    expect(res.headers.get("access-control-allow-headers")).toMatch(/authorization/i);
    expect(res.headers.get("access-control-allow-methods")).toMatch(/POST/);
  });

  it("lets the real request through with the origin allowed", () => {
    const res = proxy(req("/api/extension/score", { method: "POST", origin: EXT }));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
  });

  it("never allows a web page's origin", () => {
    const res = proxy(req("/api/extension/profile", { method: "OPTIONS", origin: "https://evil.example" }));
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("does not send extension API calls to the login page", () => {
    const res = proxy(req("/api/extension/kit", { method: "POST" }));
    expect(res.headers.get("location")).toBeNull();
    expect(config.matcher).toContain("/api/extension/:path*");
  });

  it("still sends signed-out app pages to login", () => {
    expect(proxy(req("/app/facts")).headers.get("location")).toContain("/login?next=%2Fapp%2Ffacts");
  });
});
