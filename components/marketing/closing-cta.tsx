import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { container } from "./section";

export function ClosingCta() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] atmosphere grain">
        <div className={`${container} relative py-16 text-center sm:py-24`}>
          <h2 className="mx-auto max-w-[18ch] font-display text-[36px] leading-[1.02] font-semibold sm:text-[56px]">
            Summer 2027 internships are posting now.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[17px] leading-7 text-muted-foreground">
            Start with a few facts about you and one job you want. Proofline takes it from there.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="xl" asChild className="w-full px-6 sm:w-auto">
              <Link href={site.routes.signUp}>
                Get started
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button size="xl" variant="outline" asChild className="w-full bg-background/70 px-6 sm:w-auto">
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
