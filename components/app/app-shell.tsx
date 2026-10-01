"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardPaste, House, ListChecks, LogOut, Search, Settings, SquareKanban, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { signOut } from "@/lib/auth-client";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; mobile?: boolean; short?: string };

// The loop: your experience, finding or pasting a job, its resume, and your applications.
const NAV: NavItem[] = [
  { href: "/app", label: "Home", icon: House, mobile: true },
  { href: "/app/find", label: "Find jobs", icon: Search, mobile: true },
  { href: "/app/jobs", label: "My jobs", icon: ClipboardPaste, mobile: true },
  { href: "/app/facts", label: "My experience", short: "Experience", icon: ListChecks, mobile: true },
  { href: "/app/tracker", label: "Applications", icon: SquareKanban, mobile: true },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export type ShellUser = { name: string; email: string };
export type ShellFacts = { confirmed: number; toReview: number };

export function AppShell({ user, facts, children }: { user: ShellUser; facts: ShellFacts; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <div className="flex min-h-dvh">
      <aside aria-label="Sidebar" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <Link href="/app" className="flex h-14 items-center gap-2 px-5">
          <LogoMark className="size-5" />
          <span className="font-display text-[16px] font-semibold">{site.name}</span>
        </Link>

        <nav aria-label="App" className="flex flex-col gap-0.5 px-3 pt-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] transition-colors",
                isActive(href)
                  ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t p-4">
          <ProfileMeter facts={facts} />
          <UserMenu user={user} className="mt-4" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-md md:hidden">
          <Link href="/app" className="flex items-center gap-2">
            <LogoMark className="size-5" />
            <span className="font-display text-[16px] font-semibold">{site.name}</span>
          </Link>
          <UserMenu user={user} compact />
        </header>

        <main id="main" tabIndex={-1} className="relative isolate flex-1 pb-36 md:pb-24">
          {/* A little morning light at the top of every page. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 atmosphere-soft opacity-45 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          {children}
        </main>

        <nav
          aria-label="App"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        >
          {NAV.filter((n) => n.mobile).map(({ href, label, short, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 px-0.5 py-2 text-center text-[11px] leading-3.5",
                isActive(href) ? "text-foreground" : "text-subtle-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={isActive(href) ? 2 : 1.75} />
              {short ?? label}
            </Link>
          ))}
        </nav>
      </div>
      <FeedbackButton />
      {/* On phones, keep toasts above the bottom tab bar instead of covering it. */}
      <Toaster position="bottom-right" mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }} />
    </div>
  );
}

function ProfileMeter({ facts }: { facts: ShellFacts }) {
  const total = Math.max(1, facts.confirmed + facts.toReview);
  return (
    <Link href="/app/facts" className="block rounded-md">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium">My experience</span>
        <span className="text-subtle-foreground tabular-nums">{facts.confirmed} saved</span>
      </div>
      <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-muted">
        <span className="bg-brand" style={{ width: `${(facts.confirmed / total) * 100}%` }} />
        <span className="bg-pending" style={{ width: `${(facts.toReview / total) * 100}%` }} />
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        {facts.toReview > 0 ? (
          <span className="text-pending-ink">{facts.toReview} waiting on you</span>
        ) : facts.confirmed === 0 ? (
          "Tell me about yourself"
        ) : (
          "All checked"
        )}
      </p>
    </Link>
  );
}

function UserMenu({ user, compact, className }: { user: ShellUser; compact?: boolean; className?: string }) {
  const router = useRouter();
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        className={cn(
          "flex items-center gap-2.5 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          compact ? "p-1" : "w-full p-1 hover:bg-background/60",
          className,
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
          {initials || "?"}
        </span>
        {!compact && (
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium">{user.name}</span>
            <span className="block truncate text-[11.5px] text-muted-foreground">{user.email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/app/settings")}>
          <Settings />
          Settings and your data
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
