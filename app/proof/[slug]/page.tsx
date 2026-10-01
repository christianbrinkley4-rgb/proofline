import type { Metadata } from "next";
import Link from "next/link";
import { Check, Quote } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { container } from "@/components/marketing/section";
import { proofView, type ProofBullet, type ProofSource } from "@/lib/proof/share";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How this resume was made",
  robots: { index: false, follow: false },
};

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null);

export default async function ProofPage({ params }: { params: Promise<{ slug: string }> }) {
  const view = await proofView((await params).slug);
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className={`${container} flex h-14 max-w-3xl items-center justify-between`}>
          <Link href="/" aria-label={`${site.name} home`}>
            <Logo />
          </Link>
          <span className="text-[12.5px] text-subtle-foreground">Shared by the candidate</span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={`${container} max-w-3xl py-12 sm:py-16`}>{view.state === "ok" ? <Proof view={view} /> : <Unavailable view={view} />}</main>
    </div>
  );
}

function Unavailable({ view }: { view: Exclude<Awaited<ReturnType<typeof proofView>>, { state: "ok" }> }) {
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-[32px] leading-tight font-semibold">{view.state === "changed" ? "This version has changed." : "This link isn't active."}</h1>
      <p className="mt-3 text-[16px] leading-7 text-muted-foreground">
        {view.state === "changed"
          ? `${view.firstName} updated their facts after sharing this link, so this page no longer vouches for the old version. Ask ${view.firstName} for the current link.`
          : "The person who shared it may have stopped sharing. Ask them for a new link."}
      </p>
    </div>
  );
}

function Proof({ view }: { view: Extract<Awaited<ReturnType<typeof proofView>>, { state: "ok" }> }) {
  const first = view.firstName;
  return (
    <>
      <p className="inline-flex items-center gap-2 font-mono text-[12px] tracking-wide text-brand-ink uppercase">
        <span aria-hidden="true" className="h-px w-5 bg-brand" />
        How this resume was made
      </p>
      <h1 className="mt-4 font-display text-[34px] leading-[1.05] font-semibold text-balance sm:text-[44px]">{view.name}&apos;s resume, line by line</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        {[view.job ? `Built for ${view.job.title} at ${view.job.company}` : null, `Reviewed ${date(view.reviewedAt ?? view.builtAt)}`].filter(Boolean).join(" · ")}
      </p>

      <section aria-label="What this page shows" className="mt-8 rounded-2xl border border-brand/30 bg-brand-soft/40 p-5 sm:p-6">
        <ul className="space-y-3 text-[14.5px] leading-6">
          <li className="flex gap-2.5">
            <Check className="mt-1 size-4 shrink-0 text-brand" strokeWidth={3} aria-hidden="true" />
            <span>
              Every line comes from something {first} confirmed in {site.name}, in their own words, before this resume could be downloaded.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Check className="mt-1 size-4 shrink-0 text-brand" strokeWidth={3} aria-hidden="true" />
            <span>Every number was checked against those facts. {site.name} blocks a download when a line claims anything {first} didn&apos;t confirm.</span>
          </li>
          <li className="flex gap-2.5 text-muted-foreground">
            <span aria-hidden="true" className="mt-2.5 ml-1 size-1.5 shrink-0 rounded-full bg-border-strong" />
            <span>
              {site.name} doesn&apos;t contact employers or schools, so it can&apos;t confirm that a job happened. It shows that nothing here was invented or inflated by
              software.
            </span>
          </li>
        </ul>
      </section>

      <div className="mt-10 space-y-10">
        {view.sections.map((section) => (
          <section key={section.title}>
            <h2 className="border-b pb-2 text-[13px] font-semibold tracking-wide text-subtle-foreground uppercase">{section.title}</h2>
            {section.lines && (
              <>
                <ul className="mt-3 space-y-1 text-[14.5px] leading-6">
                  {section.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[12.5px] text-subtle-foreground">From {first}&apos;s confirmed facts.</p>
              </>
            )}
            {section.entries?.map((entry) => (
              <div key={entry.heading + entry.dates} className="mt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="text-[15.5px] font-semibold">{entry.heading}</h3>
                  <span className="text-[13px] text-muted-foreground tabular-nums">{entry.dates}</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {entry.bullets.map((bullet) => (
                    <BulletProof key={bullet.text} bullet={bullet} first={first} />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>

      <footer className="mt-14 border-t pt-6 text-[13.5px] leading-6 text-muted-foreground">
        {site.name} builds resumes only from what people confirm about themselves.{" "}
        <Link href="/check" className="font-medium text-foreground underline underline-offset-2">
          Check your own resume
        </Link>
        .
      </footer>
    </>
  );
}

const WORDING: Record<ProofBullet["wording"], (first: string) => string> = {
  own: (first) => `Written by ${first}`,
  uploaded: (first) => `From the resume ${first} uploaded`,
  rules: () => `Worded by ${site.name} from the facts below; nothing added`,
  ai: () => "Worded with AI help from what they confirmed below; every number checked",
};

const ORIGIN: Record<ProofSource["origin"], (first: string) => string> = {
  own_words: (first) => `${first}'s own words`,
  uploaded_resume: (first) => `from ${first}'s uploaded resume`,
  suggested: () => "suggested by software",
};

const same = (a: string, b: string) => a.trim().replace(/[.\s]+$/, "").toLowerCase() === b.trim().replace(/[.\s]+$/, "").toLowerCase();

function BulletProof({ bullet, first }: { bullet: ProofBullet; first: string }) {
  // A line the person wrote or edited themselves: its own fact says it all, so earlier wordings stay off the page.
  const exact = bullet.sources.find((s) => same(s.text, bullet.text));
  return (
    <li className="rounded-xl border bg-background p-4">
      <p className="text-[15px] leading-6">{bullet.text}</p>
      <p className="mt-2 text-[12.5px] font-medium text-brand-ink">
        {exact ? `Exactly as ${first} wrote it` : WORDING[bullet.wording](first)}
        {exact?.confirmedAt ? `, confirmed ${date(exact.confirmedAt)}` : ""}
      </p>
      {!exact && bullet.sources.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {bullet.sources.map((s) => (
            <li key={s.text} className="flex gap-2 text-[13px] leading-5 text-muted-foreground">
              <Quote className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>
                <span className="text-foreground">{s.text}</span> · {ORIGIN[s.origin](first)}, confirmed by {first}
                {s.confirmedAt ? ` ${date(s.confirmedAt)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
