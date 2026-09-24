import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDashed, Mail, UserRound } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/auth";
import { getProfile } from "@/lib/kb/profile";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  const profile = await getProfile(session.user.id);
  return (
    <PageBody>
      <PageHeader title="Settings and connections" description="Manage the details that shape your search and see which integrations are available." />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border bg-background p-5 sm:p-6">
          <div className="flex items-center gap-2"><UserRound className="size-4 text-brand" /><h2 className="text-[16px] font-semibold">Account and goals</h2></div>
          <dl className="mt-4 space-y-3 text-[13.5px]">
            <div><dt className="text-subtle-foreground">Signed in as</dt><dd className="mt-0.5 break-all font-medium">{session.user.email}</dd></div>
            <div><dt className="text-subtle-foreground">Name</dt><dd className="mt-0.5">{profile?.fullName || session.user.name}</dd></div>
            <div><dt className="text-subtle-foreground">Target roles</dt><dd className="mt-0.5">{profile?.targetRoles.length ? profile.targetRoles.join(", ") : "Choose roles to improve matches"}</dd></div>
            <div><dt className="text-subtle-foreground">Target locations</dt><dd className="mt-0.5">{profile?.targetLocations.length ? profile.targetLocations.join(", ") : "Any location"}</dd></div>
          </dl>
          <Link href="/app/onboarding?step=goals" className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium hover:underline">Edit career goals <ArrowRight className="size-3.5" /></Link>
        </section>
        <section className="rounded-xl border bg-background p-5 sm:p-6">
          <div className="flex items-center gap-2"><Mail className="size-4 text-brand" /><h2 className="text-[16px] font-semibold">Connections</h2></div>
          <div className="mt-4 space-y-3 text-[13px]">
            <div className="flex items-start gap-2.5 rounded-lg border p-3">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              <div><p className="font-medium">Your Proofline account</p><p className="mt-0.5 text-muted-foreground">Your story, resumes, and application tracker are available here.</p></div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border p-3">
              <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div><p className="font-medium">Email and calendar</p><p className="mt-0.5 text-muted-foreground">Direct sending, inbox updates, and calendar sync are not connected yet. Follow-up drafts and reminders work inside the tracker.</p></div>
            </div>
          </div>
        </section>
      </div>
      <p className="mt-6 text-[12.5px] text-muted-foreground">
        Resume exports are generated from confirmed evidence. Review each document before using it, and keep applications and sent emails current in the tracker.
      </p>
    </PageBody>
  );
}
