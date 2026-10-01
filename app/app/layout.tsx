import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { requireSession } from "@/lib/auth";
import { factCounts } from "@/lib/kb/facts";
import { ensureProfile } from "@/lib/kb/profile";

export const metadata: Metadata = {
  title: { default: "Home", template: "%s · Proofline" },
};

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const session = await requireSession();
  const profile = await ensureProfile(session.user.id, session.user.name);
  const facts = await factCounts(session.user.id);

  return (
    <AppShell user={{ name: profile.fullName || session.user.name, email: session.user.email }} facts={facts}>
      {children}
    </AppShell>
  );
}
