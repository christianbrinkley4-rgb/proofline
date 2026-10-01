import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { ProductDemo } from "./product-demo";
import { container, wideContainer } from "./section";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden atmosphere grain">
      <div className={`${container} relative pt-16 pb-14 text-center sm:pt-24 sm:pb-20`}>
        <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-background/70 py-1 pr-3 pl-2 text-[13px] text-muted-foreground motion-safe:animate-rise">
          <span className="grid size-4 place-items-center rounded-full bg-brand text-background">
            <Check className="size-2.5" strokeWidth={3.5} />
          </span>
          Free during the beta. Built first for students.
        </p>

        <h1 className="mx-auto mt-7 max-w-[15ch] font-display text-[46px] leading-[0.98] font-semibold text-balance motion-safe:animate-rise motion-safe:[animation-delay:80ms] sm:text-[68px] lg:text-[84px]">
          The resume you can defend in the interview.
        </h1>

        <p className="mx-auto mt-6 max-w-[38rem] text-[17px] leading-7 text-pretty text-muted-foreground motion-safe:animate-rise motion-safe:[animation-delay:160ms] sm:text-[19px] sm:leading-8">
          Every line comes from something you confirmed. Nothing is invented. Paste any job and get your fit, a one-page
          resume made for it, and exactly what would make it stronger.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 motion-safe:animate-rise motion-safe:[animation-delay:240ms] sm:flex-row">
          <Button size="xl" asChild className="w-full px-6 sm:w-auto">
            <Link href={site.routes.signUp}>
              Get started
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button size="xl" variant="outline" asChild className="w-full bg-background/70 px-6 sm:w-auto">
            <a href="#how">See how it works</a>
          </Button>
        </div>
        <p className="mt-4 text-[13px] text-subtle-foreground motion-safe:animate-rise motion-safe:[animation-delay:240ms]">Any email works. Your data stays yours.</p>
      </div>

      {/* The product is the hero's visual: full width, on the same light. */}
      <div id="demo" className={`${wideContainer} relative pb-20 motion-safe:animate-rise motion-safe:[animation-delay:320ms] sm:pb-28`}>
        <div className="relative">
          <CoachNote />
          <div className="rounded-[1.4rem] border border-white/70 bg-background/50 p-1.5 shadow-lift sm:p-2">
            <ProductDemo />
          </div>
        </div>
        <p className="mt-4 text-center text-[12.5px] text-subtle-foreground">Sample data: a fictional student and made-up companies. Everything above is clickable.</p>
      </div>
    </section>
  );
}

/** The coach's voice, pinned to the demo: one next step, with the reason. */
function CoachNote() {
  return (
    <div
      aria-hidden="true"
      className="absolute -right-6 bottom-20 z-10 hidden w-72 rounded-2xl border bg-background p-4 text-left shadow-lift motion-safe:animate-rise motion-safe:[animation-delay:700ms] xl:block"
    >
      <div className="flex items-center gap-2 text-[11.5px] font-medium text-brand-ink">
        <span className="size-1.5 rounded-full bg-brand" />
        Your next step
      </div>
      <p className="mt-1.5 text-[14px] leading-5 font-semibold">Show journal entries on your resume</p>
      <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">Whitfield &amp; Lowe requires it and your resume doesn&apos;t show it yet. One sentence from you closes the gap.</p>
    </div>
  );
}
