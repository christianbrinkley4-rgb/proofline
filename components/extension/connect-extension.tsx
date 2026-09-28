"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { connectExtensionAction, disconnectExtensionsAction } from "@/app/app/extension/actions";
import { Button } from "@/components/ui/button";

/**
 * Hands a fresh token to the Proofline extension running in this browser. The
 * extension's content script on this page answers "proofline:extension-ready"
 * and stores the token when it receives it; nothing is shown on screen.
 */
export function ConnectExtension({ connected }: { connected: number }) {
  const router = useRouter();
  const [present, setPresent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();
  const waiting = useRef<number | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      if (e.data?.type === "proofline:extension-ready") setPresent(true);
      if (e.data?.type === "proofline:extension-connected") {
        if (waiting.current) window.clearTimeout(waiting.current);
        setDone(true);
        router.refresh();
      }
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ type: "proofline:page-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  const connect = () =>
    start(async () => {
      setError(null);
      const result = await connectExtensionAction().catch(() => ({ ok: false as const, error: "Couldn't reach Proofline. Try again." }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.postMessage({ type: "proofline:extension-token", token: result.token, origin: window.location.origin }, window.location.origin);
      waiting.current = window.setTimeout(() => setError("The extension didn't answer. Make sure it's installed and turned on, reload this page, and try again."), 4000);
    });

  if (done) {
    return (
      <div className="rounded-2xl border border-brand/40 bg-brand-soft/50 p-5">
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <Check className="size-4 text-brand" strokeWidth={3} aria-hidden="true" />
          This browser is connected.
        </p>
        <p className="mt-1 text-[13.5px] leading-6 text-muted-foreground">Open a job posting or an application, then click the Proofline icon in your toolbar. You can close this tab.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-background p-5 sm:p-6">
      {present ? (
        <>
          <p className="text-[15px] font-medium">The Proofline extension is installed in this browser.</p>
          <Button size="xl" className="mt-4 w-full sm:w-auto" disabled={pending} onClick={connect}>
            {pending ? <LoaderCircle className="animate-spin" /> : <PlugZap data-icon="inline-start" />}
            Connect this browser
          </Button>
        </>
      ) : (
        <>
          <p className="text-[15px] font-medium">Install the extension in Chrome or Edge</p>
          <p className="mt-1 text-[13.5px] leading-6 text-muted-foreground">During the beta it isn&apos;t in the Chrome Web Store yet, so it&apos;s installed by hand. It takes about a minute.</p>
          <ol className="mt-4 space-y-2 text-[13.5px] leading-6">
            {[
              <>
                <a href="/proofline-extension.zip" download className="font-medium text-brand-ink underline underline-offset-2">
                  Download the extension
                </a>{" "}
                and unzip it.
              </>,
              <>
                Open <span className="rounded bg-muted px-1 font-mono text-[12.5px]">chrome://extensions</span> (or{" "}
                <span className="rounded bg-muted px-1 font-mono text-[12.5px]">edge://extensions</span>) and turn on Developer mode.
              </>,
              <>Choose Load unpacked, then pick the unzipped folder.</>,
              <>Come back and reload this page.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink font-mono text-[11px] text-ink-foreground">{i + 1}</span>
                <span className="pt-px">{step}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[13.5px] text-pending-ink">
          {error}
        </p>
      )}
      {connected > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[13px] text-muted-foreground">
          <span>
            {connected} {connected === 1 ? "browser is" : "browsers are"} connected to your account.
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={disconnecting}
            onClick={() =>
              startDisconnect(async () => {
                await disconnectExtensionsAction();
                toast("Disconnected. The extension can't reach your account until you connect again.");
                router.refresh();
              })
            }
          >
            Disconnect all
          </Button>
        </div>
      )}
    </div>
  );
}
