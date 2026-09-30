import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// The browser extension calls /api/extension/* with its own token, never a cookie.
// Chrome normally skips CORS for a host the extension was granted, but when site
// access is limited (per site, on click) it sends a preflight first, and without
// these headers the request fails before it reaches Proofline. Only extension
// origins are allowed; web pages still can't read these routes.
const EXTENSION_ORIGIN = /^(chrome-extension|moz-extension|safari-web-extension):\/\/[a-z0-9-]+$/i;

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "600",
  Vary: "Origin",
});

function extensionApi(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = EXTENSION_ORIGIN.test(origin);
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: allowed ? corsHeaders(origin) : { Vary: "Origin" } });
  }
  const response = NextResponse.next();
  if (allowed) for (const [key, value] of Object.entries(corsHeaders(origin))) response.headers.set(key, value);
  return response;
}

// Optimistic check only: a missing cookie goes to login. Pages still verify the session on the server.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/extension/")) return extensionApi(request);
  if (!getSessionCookie(request)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/api/extension/:path*"],
};
