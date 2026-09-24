import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, CircleCheck, FileText, Search, Sparkles, SquareKanban, UserRound } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/auth";
import { getProfile } from "@/lib/kb/profile";
import { factCounts } from "@/lib/kb/facts";
import { listOpenQuestions } from "@/lib/kb/questions";
import { listApplications } from "@/lib/tracker/service";
import { listResumes } from "@/lib/resume/store";

export const metadata: Metadata = { title: "Agent" };

export default async function AgentPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const [profile, facts, questions, applications, resumes] = await Promise.all([
    getProfile(userId),
    factCounts(userId),
    listOpenQuestions(userId),
    listApplications(userId),
    listResumes(userId),
  ]);
  const now = new Date();
  const due = applications.filter((app) => app.stage === "applied" && app.nextFollowUpAt && app.nextFollowUpAt <= now);
  const withoutResume = applications.filter((app) => app.stage === "saved" && app.jobId && !app.resumeId);
  const targetRoles = profile?.targetRoles ?? [];

  const moves = [
    ...(facts.toReview || questions.length ? [{
      title: "Verify your story",
      detail: String(facts.toReview + questions.length) + " facts or questions need your review before they can strengthen a resume.",
      href: "/app/profile",
      icon: UserRound,
    }] : []),
    ...due.slice(0, 3).map((app) => ({
      title: "Follow up with " + app.company,
      detail: "Review a draft for your " + app.title + " application, then record it after you send it.",
      href: "/app/tracker",
      icon: CalendarClock,
    })),
    ...withoutResume.slice(0, 2).map((app) => ({
      title: "Prepare for " + app.company,
      detail: "Compare three evidence-backed resume versions for " + app.title + ".",
      href: "/app/resumes/compare?job=" + app.jobId,
      icon: FileText,
    })),
  ];

  return (
    <PageBody>
      <PageHeader
        title="Your agent"
        description="A workbench for your search. Your confirmed story drives matches and resumes; you choose what to apply for and when to send a follow-up."
      />
      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Summary value={facts.confirmed} label="Confirmed facts" href="/app/profile" />
        <Summary value={targetRoles.length} label="Target roles" href="/app/onboarding?step=goals" />
        <Summary value={applications.length} label="Tracked opportunities" href="/app/tracker" />
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)]">
        <section className="rounded-xl border bg-background p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" />
            <h2 className="text-[17px] font-semibold tracking-tight">What needs your attention</h2>
          </div>
          {moves.length ? (
            <div className="mt-4 space-y-2">
              {moves.map(({ title, detail, href, icon: Icon }, index) => (
                <Link key={href + String(index)} href={href} className="flex items-start gap-3 rounded-lg border p-3.5 transition-colors hover:bg-muted/60">
                  <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-5 text-muted-foreground">{detail}</span>
                  </span>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed p-5">
              <CircleCheck className="size-5 text-brand" />
              <p className="mt-2 text-[13.5px] font-medium">You are caught up.</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Add another life experience or explore roles to keep your search moving.</p>
            </div>
          )}
        </section>
        <section className="rounded-xl border bg-background p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold tracking-tight">How your search works</h2>
          <ol className="mt-4 space-y-3 text-[13px]">
            <li className="flex gap-3"><UserRound className="mt-0.5 size-4 shrink-0 text-brand" /><span><strong>Capture your life.</strong> Add work, projects, volunteering, and wins. Review any inferred claims.</span></li>
            <li className="flex gap-3"><Search className="mt-0.5 size-4 shrink-0 text-brand" /><span><strong>Find a fit.</strong> Compare your confirmed evidence with open roles and see gaps.</span></li>
            <li className="flex gap-3"><FileText className="mt-0.5 size-4 shrink-0 text-brand" /><span><strong>Choose a resume.</strong> Compare versions built for a listing; keep the exact version you used.</span></li>
            <li className="flex gap-3"><SquareKanban className="mt-0.5 size-4 shrink-0 text-brand" /><span><strong>Track the outcome.</strong> Record stages, contacts, notes, and follow-ups.</span></li>
          </ol>
          <p className="mt-5 border-t pt-4 text-[12px] leading-5 text-muted-foreground">
            Email sending and application submission are manual today. Proofline drafts a follow-up and records it only when you say you sent it.
          </p>
        </section>
      </div>
      <div className="mt-6 flex flex-wrap gap-3 text-[13px]">
        <Link href="/app/profile" className="font-medium hover:underline">Add to your story <ArrowRight className="inline size-3.5" /></Link>
        <Link href="/app/jobs" className="font-medium hover:underline">Explore jobs <ArrowRight className="inline size-3.5" /></Link>
        <Link href="/app/resumes" className="font-medium hover:underline">See {resumes.length} resume versions <ArrowRight className="inline size-3.5" /></Link>
      </div>
    </PageBody>
  );
}

function Summary({ value, label, href }: { value: number; label: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-background p-4 transition-colors hover:border-border-strong">
      <span className="text-[12.5px] text-subtle-foreground">{label}</span>
      <span className="mt-1 block text-[26px] font-semibold tracking-tight tabular-nums">{value}</span>
    </Link>
  );
}
