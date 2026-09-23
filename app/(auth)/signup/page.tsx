import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/app");
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
