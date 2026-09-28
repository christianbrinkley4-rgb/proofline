"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";
import { PRIVATE_BETA_CODE } from "@/lib/beta-access";

type Mode = "signup" | "login";

/** Turns auth-library messages into plain next steps. */
function friendlyError(message: string | undefined, mode: Mode) {
  const text = (message ?? "").toLowerCase();
  if (text.includes("too short")) return "Use a password with at least 8 characters.";
  if (text.includes("too long")) return "That password is too long. Try one under 128 characters.";
  if (text.includes("already exists") || text.includes("already registered")) {
    return "There's already an account with that email. Sign in instead.";
  }
  if (text.includes("invalid email or password") || text.includes("invalid password")) {
    return "That email and password don't match. Check both and try again.";
  }
  if (text.includes("invalid email")) return "That email doesn't look right. Check it and try again.";
  if (message) return message;
  return mode === "signup" ? "We couldn't create your account. Try again." : "We couldn't sign you in. Try again.";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [closed, setClosed] = useState(false);

  // A plain submit handler, not a form action: React resets a form after its action
  // runs, which would wipe what the person typed whenever sign-up fails.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const result =
      mode === "signup"
        ? await signUp.email({ email, password, name: String(form.get("name") ?? "").trim() || email.split("@")[0] })
        : await signIn.email({ email, password });

    if (result.error) {
      if (result.error.code === PRIVATE_BETA_CODE) {
        setClosed(true);
        setPending(false);
        return;
      }
      setError(friendlyError(result.error.message, mode));
      setPending(false);
      return;
    }
    const next = params.get("next");
    router.push(mode === "signup" ? "/app/onboarding" : next?.startsWith("/app") ? next : "/app");
    router.refresh();
  }

  if (closed) {
    return (
      <div role="status">
        <span className="grid size-10 place-items-center rounded-xl bg-muted">
          <LockKeyhole className="size-5 text-muted-foreground" />
        </span>
        <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">Sign-up is limited right now</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
          Sign-up is open to invited testers only, and that email isn&apos;t on the list. If you were invited, use the exact address the
          invite went to.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setClosed(false)}>
            Try another email
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/contact">Ask to join</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        {mode === "signup"
          ? "Free during the beta. Any email works."
          : "Sign in to pick up where you left off."}
      </p>

      <form method="post" onSubmit={onSubmit} className="mt-8 space-y-4" aria-describedby={error ? "auth-error" : undefined}>
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" autoComplete="name" required className="h-10" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
            aria-describedby={mode === "signup" ? "password-hint" : undefined}
            className="h-10"
          />
          {mode === "signup" ? (
            <p id="password-hint" className="text-[12.5px] text-subtle-foreground">
              At least 8 characters.
            </p>
          ) : (
            <Link href="/forgot-password" className="inline-block pt-1 text-[12.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Forgot your password?
            </Link>
          )}
        </div>

        {error && (
          <p id="auth-error" role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="xl" className="w-full" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          {mode === "signup" ? "Create account" : "Sign in"}
          {!pending && <ArrowRight data-icon="inline-end" />}
        </Button>
      </form>

      <p className="mt-6 text-[14px] text-muted-foreground">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
