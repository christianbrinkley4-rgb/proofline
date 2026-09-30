import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { LinkedInKitView } from "@/components/facts/linkedin-kit";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { ensureFactBase, loadFactBase } from "@/lib/facts/base";
import { getProfile } from "@/lib/kb/profile";
import { buildLinkedInKit } from "@/lib/linkedin/profile-kit";

export const metadata: Metadata = { title: "LinkedIn profile" };

export default async function LinkedInPage() {
  const session = await requireSession();
  const userId = session.user.id;
  await ensureFactBase(userId);
  const [base, profile] = await Promise.all([loadFactBase(userId), getProfile(userId)]);
  const kit = buildLinkedInKit(base, { targetRoles: profile?.targetRoles, gradDate: profile?.gradDate });
  const empty = base.roles.length === 0 && base.education.length === 0;

  return (
    <PageBody className="max-w-3xl">
      <Link href="/app/facts" className="inline-flex min-h-6 items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        My facts
      </Link>
      <PageHeader
        className="mt-3"
        title="Your LinkedIn profile"
        description="Recruiters check LinkedIn after your resume. This is the same story, in LinkedIn's fields, so the two match. Copy each part and paste it in yourself; Proofline never posts for you."
      />
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px] leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
        Built from {kit.factCount} confirmed {kit.factCount === 1 ? "fact" : "facts"}. Change a fact on My facts and this page changes with it.
      </p>

      <div className="mt-8">
        {empty ? (
          <div className="rounded-2xl border border-dashed border-border-strong p-6 text-center">
            <p className="text-[15px] font-medium">Add your school and one experience first.</p>
            <p className="mt-1 text-[13.5px] text-muted-foreground">Your LinkedIn text is built only from facts you&apos;ve confirmed.</p>
            <Button size="lg" className="mt-4" asChild>
              <Link href="/app/facts">Go to My facts</Link>
            </Button>
          </div>
        ) : (
          <LinkedInKitView kit={kit} />
        )}
      </div>
    </PageBody>
  );
}
