import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) {
    // Already signed in: go where the link was headed (the extension's Connect page, say).
    const next = (await searchParams).next;
    redirect(typeof next === "string" && next.startsWith("/app") ? next : "/app");
  }
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
