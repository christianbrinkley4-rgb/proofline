import type { ErrorEvent } from "@sentry/nextjs";

export function stripPrivateData(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }
  event.user = event.user?.id ? { id: event.user.id } : undefined;
  event.breadcrumbs = undefined;
  event.extra = event.extra?.occurredAt ? { occurredAt: event.extra.occurredAt } : undefined;
  return event;
}
