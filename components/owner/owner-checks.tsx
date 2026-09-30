"use client";

import { useState, useTransition } from "react";
import { Check, Copy, LoaderCircle } from "lucide-react";
import { runAiCheckAction, sendTestEmailAction } from "@/app/app/owner/actions";
import { Button } from "@/components/ui/button";
import type { AiHealth } from "@/lib/review/health";
import { cn } from "@/lib/utils";

function Result({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <p role="status" className={cn("mt-2 text-[13px] leading-5", ok ? "text-brand-ink" : "text-destructive")}>{children}</p>;
}

export function AiCheck() {
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setFailed(false);
            setHealth(await runAiCheckAction().catch(() => (setFailed(true), null)));
          })
        }
      >
        {pending && <LoaderCircle className="animate-spin" />}
        Check AI now
      </Button>
      {failed && <Result ok={false}>The check couldn&apos;t run. Reload the page and try again.</Result>}
      {health && (
        <div className="mt-2 space-y-1">
          <Result ok={health.review.ok}>Resume review: {health.review.detail}</Result>
          <Result ok={health.wording.ok}>Fact wording: {health.wording.detail}</Result>
          <p className="text-[12px] text-muted-foreground">
            {health.model}, {(health.ms / 1000).toFixed(1)}s. Made-up data only; no tester&apos;s allowance was used.
          </p>
        </div>
      )}
    </div>
  );
}

export function TestEmail() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => start(async () => setResult(await sendTestEmailAction().catch(() => ({ ok: false, message: "The test couldn't run. Reload and try again." }))))}
      >
        {pending && <LoaderCircle className="animate-spin" />}
        Send me a test email
      </Button>
      {result && <Result ok={result.ok}>{result.message}</Result>}
    </div>
  );
}

export function CopyText({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
