import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { emailConfigured } from "@/lib/email";

export const metadata: Metadata = { title: "Reset your password" };
// Read the email setting per request, so adding a provider later changes the message without a rebuild.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm emailConfigured={emailConfigured()} />;
}
