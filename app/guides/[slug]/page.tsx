import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { container } from "@/components/marketing/section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { GUIDES, guide, type GuideBlock } from "@/lib/guides/content";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const g = guide((await params).slug);
  return g ? { title: g.title, description: g.description } : { title: "Guide" };
}

export default async function GuidePage({ params }: Params) {
  const g = guide((await params).slug);
  if (!g) notFound();
  const updated = new Date(`${g.updated}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className={`${container} max-w-2xl py-14 sm:py-20`}>
          <Link href="/guides" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            All guides
          </Link>
          <h1 className="mt-6 font-display text-[36px] leading-[1.05] font-semibold text-balance sm:text-[46px]">{g.title}</h1>
          <p className="mt-4 text-[18px] leading-8 text-pretty text-muted-foreground">{g.description}</p>
          <p className="mt-4 text-[13px] text-subtle-foreground">
            Updated {updated} · {g.minutes} minute read
          </p>

          {g.sections.map((section) => (
            <section key={section.heading} className="mt-12">
              <h2 className="font-display text-[24px] leading-tight font-semibold">{section.heading}</h2>
              <div className="mt-4 space-y-5">
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
            </section>
          ))}

          <aside className="mt-14 rounded-2xl bg-ink p-6 text-ink-foreground sm:p-8">
            <p className="font-display text-[24px] leading-tight font-semibold">See which lines you&apos;ll be asked about.</p>
            <p className="mt-2 text-[15px] leading-7 text-ink-muted">Paste your resume into the free check. No account needed, and nothing you paste is saved.</p>
            <Button size="lg" variant="secondary" className="mt-5" asChild>
              <Link href="/check">
                Check my resume
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </aside>

          {g.sources.length > 0 && (
            <section className="mt-12 border-t pt-6">
              <h2 className="text-[13px] font-semibold tracking-wide text-subtle-foreground uppercase">Sources</h2>
              <ul className="mt-3 space-y-2">
                {g.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[14px] leading-6 underline-offset-2 hover:underline">
                      {s.label}
                      <ArrowUpRight className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Block({ block }: { block: GuideBlock }) {
  if (block.kind === "p") return <p className="text-[16.5px] leading-8 text-pretty">{block.text}</p>;
  if (block.kind === "list") {
    return (
      <ul className="space-y-3">
        {block.items.map((item) => (
          <li key={item} className="flex gap-3 text-[16.5px] leading-7">
            <span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-brand" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-3">
      {block.items.map((ex) => (
        <figure key={ex.role} className="rounded-xl border p-4 sm:p-5">
          <figcaption className="text-[12.5px] font-medium tracking-wide text-subtle-foreground uppercase">{ex.role}</figcaption>
          <p className="mt-2 text-[15px] leading-6 text-muted-foreground line-through decoration-border-strong">{ex.before}</p>
          <p className="mt-1 text-[15.5px] leading-7 font-medium">{ex.after}</p>
          <p className="mt-2 text-[13.5px] leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">How you&apos;d know: </span>
            {ex.how}
          </p>
        </figure>
      ))}
    </div>
  );
}
