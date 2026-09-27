"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type FormAction = (form: FormData) => Promise<void>;

/**
 * A server-action form that shows it's working and says so when it fails, instead
 * of a button that seems to do nothing or a crash page.
 */
export function ActionForm({
  action,
  submitLabel,
  variant = "default",
  className,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  variant?: "default" | "outline";
  className?: string;
  children: ReactNode;
}) {
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(false);
    startTransition(async () => {
      try {
        await action(data);
        form.reset();
      } catch {
        setError(true);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
      <Button type="submit" variant={variant} disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        {submitLabel}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          That didn&apos;t save. Check what you entered and try again.
        </p>
      )}
    </form>
  );
}

/**
 * Saves a check-in and tells the person what happened. With no reflection and no
 * change in evidence the server records nothing, so say that plainly.
 */
export function CheckinForm({
  action,
  children,
}: {
  action: (form: FormData) => Promise<{ created: boolean }>;
  children: ReactNode;
}) {
  const [outcome, setOutcome] = useState<"saved" | "unchanged" | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(false);
    setOutcome(null);
    startTransition(async () => {
      try {
        const result = await action(data);
        setOutcome(result.created ? "saved" : "unchanged");
        if (result.created) form.reset();
      } catch {
        setError(true);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} onChange={() => setOutcome(null)} className="mt-5">
      {children}
      <Button type="submit" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        Save a progress check-in
      </Button>
      <div aria-live="polite" className="mt-2 text-xs">
        {outcome === "saved" && (
          <p className="flex items-center gap-1.5 font-medium text-brand-ink">
            <Check className="size-3.5" strokeWidth={2.5} />
            Check-in saved. It&apos;s at the top of your trajectory.
          </p>
        )}
        {outcome === "unchanged" && (
          <p className="text-pending-ink">Nothing new to save yet. Write what you learned, or add evidence to your profile first.</p>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            That didn&apos;t save. Try again in a moment.
          </p>
        )}
        {!outcome && !error && <p className="text-muted-foreground">A reflection or a change in evidence creates a new check-in.</p>}
      </div>
    </form>
  );
}
