import * as Sentry from "@sentry/nextjs";
import { unstable_rethrow } from "next/navigation";
import { getSession } from "@/lib/auth";
import { captureError } from "./errors";

export async function monitoredAction<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    const session = await getSession().catch(() => null);
    captureError(error, operation, session?.user.id);
    throw new Error("Something went wrong. Your saved work is still there. Try again.");
  } finally {
    if (process.env.SENTRY_DSN) await Sentry.flush(2000).catch(() => false);
  }
}
