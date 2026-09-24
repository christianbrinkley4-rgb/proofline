import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { ProductDemo } from "./product-demo";
import { container } from "./section";

export function Hero() {
  return (
    <section className="relative">
      <div className={`${container} pt-14 pb-12 sm:pt-20 sm:pb-16`}>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-7">
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-full border bg-background py-1 pr-2.5 pl-3 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              <span className="size-1.5 rounded-full bg-brand" />
              Free for students and recent grads during beta
              <ArrowRight className="size-3.5" />
            </a>
            {/* Keep the promise visible before the product tour. */}
            <h1 className="mt-6 text-[42px] leading-[1.04] font-semibold tracking-[-0.04em] text-balance sm:text-[56px] md:text-[64px] lg:text-[52px] xl:text-[60px]">
              Everything you have done can lead somewhere new.
            </h1>
          </div>

          <div className="lg:col-span-5 lg:pb-2">
            <p className="max-w-[36rem] text-[17px] leading-7 text-pretty text-muted-foreground sm:text-[18px] sm:leading-8">
              Keep a living record of your work, classes, projects, and wins. {site.name} finds roles that fit,
              builds job-specific resumes and cover letters from your confirmed facts, preps you for the interview, and
              tracks every application and follow-up.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="xl" asChild>
                <Link href={site.routes.signUp}>
                  Start free
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <a href="#how">See it work</a>
              </Button>
              <span className="text-[13px] text-subtle-foreground sm:ml-2">No credit card.</span>
            </div>
          </div>
        </div>
      </div>

      <div id="how" className="relative pb-20 sm:pb-28">
        {/* Grey stage behind the lower part of the demo. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-28 bottom-0 border-t bg-muted/70" />
        <div className={`${container} relative`}>
          <ProductDemo />
          <p className="mt-4 text-center text-[12.5px] text-subtle-foreground">
            Sample student, made-up companies. Everything above is clickable.
          </p>
        </div>
      </div>
    </section>
  );
}
