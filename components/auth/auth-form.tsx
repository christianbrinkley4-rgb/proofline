"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "signup" | "login";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setPending(true);
    setError(null);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const result =
      mode === "signup"
        ? await signUp.email({ email, password, name: String(form.get("name") ?? "").trim() || email.split("@")[0] })
        : await signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "That didn't work. Try again.");
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

      <form action={onSubmit} className="mt-8 space-y-4">
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
            className="h-10"
          />
          {mode === "signup" && <p className="text-[12.5px] text-subtle-foreground">At least 8 characters.</p>}
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
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
