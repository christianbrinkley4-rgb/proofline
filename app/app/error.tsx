"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-5 py-16" role="alert">
      <h1 className="font-display text-2xl font-semibold">This page didn&apos;t load</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        That&apos;s on us, not you. Anything you&apos;d already saved is still there. Try again, or pick up from Today.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => router.push("/app")}>Go to Today</Button>
      </div>
    </div>
  );
}
