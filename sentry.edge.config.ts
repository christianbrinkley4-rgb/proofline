import * as Sentry from "@sentry/nextjs";
import { stripPrivateData } from "./lib/monitoring/options";

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, beforeSend: stripPrivateData, dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false, stackFrameVariables: false, queues: false, genAI: { inputs: false, outputs: false }, graphQL: { document: false, variables: false } },
    tracesSampleRate: 0 });
}
