"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset, retry }: { error: Error & { digest?: string }; reset?: () => void; retry?: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="en">
      <body>
        <main role="alert" style={{ maxWidth: 560, margin: "64px auto", padding: 24, fontFamily: "sans-serif" }}>
          <h1>Proofline couldn&apos;t load</h1>
          <p>Your saved work is still there. Try loading the page again.</p>
          <button onClick={() => (retry ?? reset ?? (() => window.location.reload()))()}>Try again</button>
          <p><a href="/app">Go to Today</a></p>
        </main>
      </body>
    </html>
  );
}
