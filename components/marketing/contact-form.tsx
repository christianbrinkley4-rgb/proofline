"use client";

import { useState, type FormEvent } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { sendContactAction } from "@/app/contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("sending");
    setError(null);
    const result = await sendContactAction({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      message: String(form.get("message") ?? ""),
      website: String(form.get("website") ?? ""),
    }).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Check your connection and try again." }));
    if (!result.ok) {
      setError(result.error);
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-brand/30 bg-brand-soft/60 p-5">
        <p className="flex items-center gap-2 text-[15px] font-medium">
          <Check className="size-4 text-brand-ink" strokeWidth={3} />
          Got it. Thanks for writing.
        </p>
        <p className="mt-1 text-[14px] text-muted-foreground">We read every message and reply to the email you gave.</p>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" aria-describedby={error ? "contact-error" : undefined}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">Name</Label>
          <Input id="contact-name" name="name" autoComplete="name" maxLength={120} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} className="h-10" />
        </div>
      </div>
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea id="contact-message" name="message" required minLength={10} maxLength={4000} rows={6} className="text-[14.5px] leading-6" />
      </div>
      {error && (
        <p id="contact-error" role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="xl" disabled={status === "sending"}>
        {status === "sending" ? <LoaderCircle className="animate-spin" /> : null}
        Send message
      </Button>
    </form>
  );
}
