import type { Metadata } from "next";
import { DefendCheck } from "@/components/check/defend-check";
import { container } from "@/components/marketing/section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Free resume check: can you defend every line?",
  description: "Paste your resume and see every line a recruiter will ask you to back up, the words that invite a follow-up, and how it compares with a job. Free, no account, nothing saved.",
};

export default function CheckPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="relative isolate overflow-hidden atmosphere grain">
          <div className={`${container} relative max-w-3xl pt-14 pb-10 sm:pt-20`}>
            <p className="inline-flex items-center gap-2 font-mono text-[12px] tracking-wide text-brand-ink uppercase">
              <span aria-hidden="true" className="h-px w-5 bg-brand" />
              Free resume check
            </p>
            <h1 className="mt-4 font-display text-[40px] leading-[1.02] font-semibold text-balance sm:text-[56px]">Can you defend every line?</h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-7 text-pretty text-muted-foreground sm:text-[18px] sm:leading-8">
              Recruiters ask about the numbers on your resume. Paste yours to see every line you&apos;ll be asked to back up, the words that
              invite a follow-up, and how it lines up with a job you want.
            </p>
          </div>
        </section>
        <section className={`${container} max-w-3xl pb-20 sm:pb-28`}>
          <DefendCheck />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
