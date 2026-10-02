import * as Sentry from "@sentry/nextjs";

/** Report failures without sending form values or contact details. */
export function captureError(error: unknown, operation: string, userId?: string, at = new Date()) {
  return Sentry.withScope((scope) => {
    scope.setUser(userId ? { id: userId } : null);
    scope.setTag("operation", operation);
    scope.setExtra("occurredAt", at.toISOString());
    return Sentry.captureException(error);
  });
}
