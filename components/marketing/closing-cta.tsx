import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { container } from "./section";

export function ClosingCta() {
  return (
    <section className="bg-foreground text-background">
      <div className={`${container} py-20 sm:py-24`}>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[44px]">
              Summer 2027 internships are posting now.
            </h2>
            <p className="mt-4 text-[17px] leading-7 text-background/65">
              Start with one search and see what comes back.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="xl" asChild className="bg-background text-foreground hover:bg-background/90">
              <Link href={site.routes.signUp}>
                Start free
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              size="xl"
              variant="outline"
              asChild
              className="border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background"
            >
              <a href="#career-centers">For career centers</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
