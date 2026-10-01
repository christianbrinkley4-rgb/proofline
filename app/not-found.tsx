import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Link href="/" aria-label="Home">
        <Logo />
      </Link>
      <h1 className="mt-10 text-[32px] font-semibold tracking-[-0.03em]">We can&apos;t find that page.</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-7 text-muted-foreground">
        The link may be old or mistyped. Open Proofline to pick up where you left off.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="xl" asChild>
          <Link href="/app">Open Proofline</Link>
        </Button>
        <Button size="xl" variant="outline" asChild>
          <Link href="/">
            <ArrowLeft data-icon="inline-start" />
            Back to home
          </Link>
        </Button>
      </div>
    </main>
  );
}
