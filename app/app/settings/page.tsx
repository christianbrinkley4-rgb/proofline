import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, CircleCheck, CircleDashed, Mail, ShieldCheck, UserRound } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { AiConnections } from "@/components/settings/ai-connections";
import { requireSession } from "@/lib/auth";
import { listTokens } from "@/lib/agent/tokens";
import { getProfile } from "@/lib/kb/profile";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  const [profile, tokens] = await Promise.all([getProfile(session.user.id), listTokens(session.user.id)]);
  const mcpUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? site.url).replace(/\/$/, "")}/api/mcp`;
  return (
    <PageBody>
      <PageHeader title="Settings and connections" description="Manage the details that shape your search and connect the AI you already use." />
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
          <div className="flex items-center gap-2"><Mail className="size-4 text-brand" /><h2 className="text-[16px] font-semibold">Email and calendar</h2></div>
          <div className="mt-4 space-y-3 text-[13px]">
            <div className="flex items-start gap-2.5 rounded-lg border p-3">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              <div><p className="font-medium">Your {site.name} account</p><p className="mt-0.5 text-muted-foreground">Your story, resumes, and application tracker are available here.</p></div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border p-3">
              <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div><p className="font-medium">Email and calendar</p><p className="mt-0.5 text-muted-foreground">Direct sending, inbox updates, and calendar sync are not connected yet. Follow-up drafts and reminders work inside the tracker.</p></div>
            </div>
          </div>
        </section>
      </div>

      <section id="ai" className="mt-5 scroll-mt-20 rounded-xl border bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2"><Bot className="size-4 text-brand" /><h2 className="text-[16px] font-semibold">Use your own AI</h2></div>
        <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-muted-foreground">
          Connect Claude, Cursor, or any app that supports MCP. Your AI can read your confirmed story, search jobs, tailor resumes, draft cover letters, and help you prep for interviews, using your own AI plan instead of ours.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-[12.5px] leading-5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>
            The same rules apply to every AI: anything it learns about you is saved as a proposal you confirm here, it can&apos;t confirm facts or download files, and it never applies or sends email for you. Revoke a token any time.
          </span>
        </div>
        <div className="mt-5">
          <AiConnections
            mcpUrl={mcpUrl}
            tokens={tokens.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, createdAt: t.createdAt.toISOString(), lastUsedAt: t.lastUsedAt?.toISOString() ?? null }))}
          />
        </div>
        <p className="mt-4 text-[12px] leading-5 text-muted-foreground">
          Connecting from ChatGPT or claude.ai in the browser needs a sign-in flow that isn&apos;t available yet. Desktop and coding apps work with a token today.
        </p>
      </section>

      <p className="mt-6 text-[12.5px] text-muted-foreground">
        Resume exports are generated from confirmed evidence. Review each document before using it, and keep applications and sent emails current in the tracker.
      </p>
    </PageBody>
  );
}
