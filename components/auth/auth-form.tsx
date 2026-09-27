"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";

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
      setError(friendlyError(result.error.message, mode));
      setPending(false);
      return;
    }
    const next = params.get("next");
    router.push(mode === "signup" ? "/app/onboarding" : next?.startsWith("/app") ? next : "/app");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        {mode === "signup"
          ? "Free while in beta. Takes about a minute, then your agent gets to work."
          : "Sign in to pick up where your agent left off."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" aria-describedby={error ? "auth-error" : undefined}>
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
          {mode === "signup" && (
            <p id="password-hint" className="text-[12.5px] text-subtle-foreground">
              At least 8 characters.
            </p>
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
