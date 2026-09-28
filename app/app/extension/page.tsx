import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ConnectExtension } from "@/components/extension/connect-extension";
import { listTokens } from "@/lib/agent/tokens";
import { requireSession } from "@/lib/auth";
import { EXTENSION_TOKEN_NAME } from "@/lib/extension/service";

export const metadata: Metadata = { title: "Browser extension" };

const DOES = [
  "Saves the job posting you're looking at, with its fit score, in one click.",
  "Fills your name, contact details, school, degree, and links into an application form, and highlights every field it touched so you can check it.",
  "Marks the job Applied on your tracker when you tell it you submitted.",
];

const NEVER = [
  "Clicks submit or sends anything for you.",
  "Answers questions about work authorization, demographics, or anything you haven't told Proofline.",
  "Reads pages you don't open it on.",
];

export default async function ExtensionPage() {
  const session = await requireSession();
  const connected = (await listTokens(session.user.id)).filter((t) => t.name === EXTENSION_TOKEN_NAME).length;
  return (
    <PageBody className="max-w-3xl">
      <PageHeader title="Browser extension" description="Less typing on application forms, and your tracker stays current. You stay in charge of what gets sent." />
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
