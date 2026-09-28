import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, Puzzle, ShieldCheck, UserRound } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { YourData } from "@/components/settings/your-data";
import { requireSession } from "@/lib/auth";
import { getProfile } from "@/lib/kb/profile";
import { PRIVACY_POINTS } from "@/lib/privacy";
import { formatMonth } from "@/lib/resume/parse/dates";

export const metadata: Metadata = { title: "Settings" };

const AUTH_LABEL: Record<string, string> = {
  us_citizen: "U.S. citizen",
  permanent_resident: "Permanent resident",
  authorized: "Authorized, no sponsorship needed",
  needs_sponsorship: "Needs visa sponsorship",
};

export default async function SettingsPage() {
  const session = await requireSession();
  const profile = await getProfile(session.user.id);
  const modes = profile?.workModes.map((m) => (m === "onsite" ? "on-site" : m)).join(", ");
  return (
    <PageBody className="max-w-4xl">
      <PageHeader title="Settings" description="Your account, what we use to check knockouts, and your data." />
      <section className="mt-8 rounded-xl border bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-brand" />
          <h2 className="text-[16px] font-semibold">Account and knockout details</h2>
        </div>
        <dl className="mt-4 grid gap-3 text-[13.5px] sm:grid-cols-2">
          <div>
            <dt className="text-subtle-foreground">Signed in as</dt>
            <dd className="mt-0.5 font-medium break-all">{session.user.email}</dd>
          </div>
          <div>
            <dt className="text-subtle-foreground">Work authorization</dt>
            <dd className="mt-0.5">{profile?.workAuthorization ? AUTH_LABEL[profile.workAuthorization] ?? profile.workAuthorization : "Not set"}</dd>
          </div>
          <div>
            <dt className="text-subtle-foreground">Where you can work</dt>
            <dd className="mt-0.5">
              {[profile?.targetLocations.join(", "), modes, profile?.openToRelocate ? "open to moving" : profile?.openToRelocate === false ? "not moving" : null].filter(Boolean).join("; ") || "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-subtle-foreground">Earliest start</dt>
            <dd className="mt-0.5">{profile?.availableFrom ? formatMonth(profile.availableFrom) : "Not set"}</dd>
          </div>
        </dl>
        <Link href="/app/onboarding?step=logistics&back=/app/settings" className="mt-5 inline-flex min-h-10 items-center gap-1 text-[13px] font-medium hover:underline">
          Edit these <ArrowRight className="size-3.5" />
        </Link>
      </section>

      <section id="extension" className="mt-5 scroll-mt-20 rounded-xl border bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Puzzle className="size-4 text-brand" />
          <h2 className="text-[16px] font-semibold">Browser extension</h2>
        </div>
        <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-muted-foreground">
          Save a posting in one click, fill your basics into application forms for you to check, and mark jobs Applied. It never submits for you.
        </p>
        <Link href="/app/extension" className="mt-3 inline-flex min-h-10 items-center gap-1 text-[13px] font-medium hover:underline">
          Set it up <ArrowRight className="size-3.5" />
        </Link>
      </section>

      <section id="privacy" className="mt-5 scroll-mt-20 rounded-xl border bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand" />
          <h2 className="text-[16px] font-semibold">Privacy: your data is yours</h2>
        </div>
        <ul className="mt-3 space-y-2.5">
          {PRIVACY_POINTS.map((point) => (
            <li key={point.title} className="text-[13.5px] leading-6">
              <span className="font-medium">{point.title}.</span> <span className="text-muted-foreground">{point.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="data" className="mt-5 scroll-mt-20 rounded-xl border bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-brand" />
          <h2 className="text-[16px] font-semibold">Your data</h2>
        </div>
        <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-muted-foreground">Take a full copy any time, or delete it all.</p>
        <div className="mt-4">
          <YourData email={session.user.email} />
        </div>
      </section>
    </PageBody>
  );
}
