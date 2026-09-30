import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ConnectExtension } from "@/components/extension/connect-extension";
import { listTokens } from "@/lib/agent/tokens";
import { requireSession } from "@/lib/auth";
import { EXTENSION_TOKEN_NAME } from "@/lib/extension/service";

export const metadata: Metadata = { title: "Browser extension" };

const DOES = [
  "Shows your fit score on job postings on LinkedIn, Indeed, and Handshake. Click it for knockouts first, then the math behind the score.",
  "Saves the job posting you're looking at, with its fit score, in one click.",
  "On Greenhouse and Lever applications, fills the form from the job's answer kit: contact details, school, current role, links, your work authorization answers, and questions you drafted. A panel on the page lists every field it filled and what's left for you.",
  "Marks the job Applied when you tell it you submitted, and keeps the kit it filled from as your record of what you sent.",
];

const NEVER = [
  "Clicks submit or sends anything for you.",
  "Answers demographic, pay, referral, or consent questions, or anything you haven't confirmed. Those fields stay blank for you.",
  "Reads your messages, your profile on a job site, or your other tabs. On LinkedIn, Indeed, and Handshake it reads only the job posting on screen.",
  "Keeps postings you only look at. A job is saved to Proofline only when you choose to save it.",
];

export default async function ExtensionPage() {
  const session = await requireSession();
  const connected = (await listTokens(session.user.id)).filter((t) => t.name === EXTENSION_TOKEN_NAME).length;
  return (
    <PageBody className="max-w-3xl">
      <PageHeader title="Browser extension" description="Your fit score where you already look for jobs, less typing on application forms, and a tracker that stays current. Scores use only facts you've already confirmed. Nothing new is collected." />
      <div className="mt-8">
        <ConnectExtension connected={connected} />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border bg-background p-5">
          <h2 className="text-[15px] font-semibold">What it does</h2>
          <ul className="mt-3 space-y-2.5">
            {DOES.map((d) => (
              <li key={d} className="flex gap-2 text-[13.5px] leading-5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand" strokeWidth={3} aria-hidden="true" />
                {d}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border bg-background p-5">
          <h2 className="text-[15px] font-semibold">What it never does</h2>
          <ul className="mt-3 space-y-2.5">
            {NEVER.map((d) => (
              <li key={d} className="flex gap-2 text-[13.5px] leading-5">
                <X className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" strokeWidth={3} aria-hidden="true" />
                {d}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageBody>
  );
}
