"use client";

import { useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Check, LoaderCircle, MessageSquareText, X } from "lucide-react";
import { sendFeedbackMessageAction } from "@/app/app/feedback/message-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Always on screen in the app. Saves { user, message, page, time } for the owner
 * and says so, right there, when it's saved.
 */
export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    const result = await sendFeedbackMessageAction({ message, page: pathname }).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
    if (!result.ok) {
      setError(result.error);
      setStatus("idle");
      return;
    }
    setMessage("");
    setStatus("sent");
  }

  const close = () => {
    setOpen(false);
    if (status === "sent") setStatus("idle");
  };

  return (
    <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-40 flex flex-col items-end md:right-6 md:bottom-6">
      {open && (
        <div
          role="dialog"
          aria-label="Send feedback"
          className="mb-3 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border bg-background p-4 shadow-lift motion-safe:animate-view-in"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Send feedback</h2>
            <button type="button" onClick={close} aria-label="Close feedback" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          {status === "sent" ? (
            <div role="status" className="mt-3 rounded-lg bg-brand-soft/70 p-3 text-[13.5px]">
              <p className="flex items-center gap-2 font-medium">
                <Check className="size-4 text-brand-ink" strokeWidth={3} />
                Received. Thank you.
              </p>
              <p className="mt-1 text-muted-foreground">The team reads every message. You can send another anytime.</p>
            </div>
          ) : (
            <form method="post" onSubmit={onSubmit} className="mt-3 space-y-2.5">
              <Textarea
                autoFocus
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={4000}
                aria-label="Your feedback"
                placeholder="What worked, what was confusing, or what's missing?"
                className="text-[14px] leading-6"
              />
              <p className="text-[12px] text-muted-foreground">We save this page&apos;s address with your note so we can find the problem.</p>
              {error && (
                <p role="alert" className="text-[12.5px] text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" size="sm" disabled={status === "sending" || message.trim().length < 3}>
                {status === "sending" ? <LoaderCircle className="animate-spin" /> : null}
                Send
              </Button>
            </form>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className={cn(
          "flex h-11 items-center gap-2 rounded-full border bg-background px-4 text-[13.5px] font-medium shadow-lift transition-colors hover:bg-muted",
          open && "bg-muted",
        )}
      >
        <MessageSquareText className="size-4" />
        Send feedback
      </button>
    </div>
  );
}
