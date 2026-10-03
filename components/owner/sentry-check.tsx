"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SentryCheck() {
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    if (!Sentry.isInitialized() || !Sentry.getClient()?.getDsn()) {
      setResult("Browser reporting is not configured.");
      setBusy(false);
      return;
    }
    const id = Sentry.captureException(new Error("Proofline safe browser verification"), {
      tags: { operation: "monitoring.browser-check", synthetic: "true" },
    });
    const flushed = await Sentry.flush(5000);
    setResult(`Event ID: ${id}. ${flushed ? "Transport finished. Confirm receipt in the Proofline Sentry project." : "Transport timed out. Receipt is unverified."}`);
    setBusy(false);
  }
  return <div className="space-y-3"><Button onClick={check} disabled={busy}>{busy ? "Sending test event..." : "Send safe browser test"}</Button><p role="status" className="break-all text-sm">{result}</p></div>;
}
