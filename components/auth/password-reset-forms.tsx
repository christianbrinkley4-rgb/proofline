"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm({ emailConfigured }: { emailConfigured: boolean }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setPending(true);
    setError(null);
    const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    // The same answer whether or not the address has an account.
    if (result.error && result.error.status !== 404) {
      setError(result.error.status === 429 ? "Too many tries. Wait a few minutes, then try again." : "We couldn't send that request. Try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Check your email</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
          {emailConfigured
            ? "If there's an account for that address, a reset link is on its way. It works for one hour."
            : "If there's an account for that address, the Proofline team has your request and will email you a reset link by hand, usually within a day. The link works once, for 3 days."}
        </p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-1 text-[14px] font-medium underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Reset your password</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">Enter the email you signed up with.</p>
      <form method="post" onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="xl" className="w-full" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-[14px] text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (invalid || !token) {
    return (
      <div role="alert">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">That link has expired</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">Reset links work once and expire. Ask for a new one.</p>
        <Button asChild size="xl" className="mt-6">
          <Link href="/forgot-password">Get a new link</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("Those two passwords don't match.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await authClient.resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (result.error) {
      setError(/token/i.test(result.error.message ?? "") ? "That link has expired. Ask for a new one." : "Use a password with at least 8 characters.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div role="status">
        <p className="flex items-center gap-2 text-[15px] font-medium">
          <Check className="size-4 text-brand-ink" strokeWidth={3} />
          Password changed
        </p>
        <p className="mt-2 text-[15px] text-muted-foreground">Sign in with your new password. You&apos;ve been signed out everywhere else.</p>
        <Button size="xl" className="mt-6" onClick={() => router.push("/login")}>
          Sign in
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Choose a new password</h1>
      <form method="post" onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-10" />
          <p className="text-[12.5px] text-subtle-foreground">At least 8 characters.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Type it again</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="h-10" />
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="xl" className="w-full" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Save new password
        </Button>
      </form>
    </div>
  );
}
