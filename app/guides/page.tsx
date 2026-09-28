import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { container } from "@/components/marketing/section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { GUIDES } from "@/lib/guides/content";

export const metadata: Metadata = {
  title: "Resume guides",
  description: "Short, sourced guides to writing a resume you can defend: numbers you can explain, what applicant tracking systems really do, and what makes writing read as AI.",
};

export default function GuidesPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className={`${container} max-w-3xl py-16 sm:py-24`}>
          <p className="inline-flex items-center gap-2 font-mono text-[12px] tracking-wide text-brand-ink uppercase">
            <span aria-hidden="true" className="h-px w-5 bg-brand" />
            Guides
          </p>
          <h1 className="mt-4 font-display text-[40px] leading-[1.02] font-semibold text-balance sm:text-[52px]">Write a resume you can defend.</h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-7 text-muted-foreground">Short guides with the sources linked. No listicles, no invented statistics.</p>
          <ul className="mt-12 divide-y border-y">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="group flex items-start justify-between gap-6 py-6">
                  <span className="min-w-0">
                    <span className="block text-[19px] leading-7 font-semibold group-hover:underline group-hover:underline-offset-4">{g.title}</span>
                    <span className="mt-1.5 block text-[15px] leading-6 text-muted-foreground">{g.description}</span>
                    <span className="mt-2 block text-[12.5px] text-subtle-foreground">{g.minutes} minute read</span>
                  </span>
                  <ArrowRight className="mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
