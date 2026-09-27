"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error("Proofline page error", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-5 py-16" role="alert">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Try this page again. If it keeps happening, return to your dashboard to check what saved and continue there.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => router.push("/app")}>Go to dashboard</Button>
      </div>
    </main>
  );
}