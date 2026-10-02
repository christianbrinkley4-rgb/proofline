import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!process.env.SENTRY_DSN) return;
  let userId: string | undefined;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { auth } = await import("./lib/auth");
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (value) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      userId = (await auth.api.getSession({ headers }))?.user.id;
    } catch {
      // Authentication may be the failed dependency; still capture the error.
    }
  }
  await Sentry.withScope(async (scope) => {
    scope.setUser(userId ? { id: userId } : null);
    scope.setExtra("occurredAt", new Date().toISOString());
    await Sentry.captureRequestError(error, request, context);
  });
};
