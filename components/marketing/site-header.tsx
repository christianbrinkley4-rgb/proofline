import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { container } from "./section";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#proof", label: "Proof, not guesses" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-md">
      <div className={`${container} flex h-14 items-center justify-between gap-4`}>
        <Link href="/" aria-label={`${site.name} home`} className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-[14px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="lg" asChild className="px-3 text-[14px]">
            <Link href={site.routes.signIn}>Sign in</Link>
          </Button>
          <Button size="lg" asChild className="rounded-full px-4 text-[14px]">
            <Link href={site.routes.signUp}>Start free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
