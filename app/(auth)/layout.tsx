import Link from "next/link";
import { Check, CircleAlert } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,40rem)]">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <header className="self-start">
          <Link href="/" aria-label="Proofline home" className="block rounded-md">
            <Logo />
          </Link>
        </header>
        <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>

      <aside aria-hidden="true" className="relative hidden overflow-hidden bg-zinc-950 text-zinc-100 lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <p className="font-mono text-[12px] text-zinc-500">Beta</p>
          <h2 className="mt-3 max-w-md text-[34px] leading-[1.1] font-semibold tracking-[-0.03em]">
            Every line on your resume traces back to something you confirmed.
          </h2>
          <div className="mt-10 max-w-md space-y-2.5">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="text-[13.5px]">Caught $3,200 in duplicate payments</span>
              <span className="flex items-center gap-1 text-[12px] font-medium text-brand">
                <Check className="size-3.5" strokeWidth={3} />
                Confirmed
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-pending/30 bg-pending/[0.06] px-4 py-3">
              <span className="text-[13.5px]">Saved about 3 hours a week</span>
              <span className="flex items-center gap-1 text-[12px] font-medium text-pending">
                <CircleAlert className="size-3.5" strokeWidth={2.5} />
                Asking you
              </span>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-[13.5px] text-zinc-400">
              Review passed. Every number matches a fact you confirmed.
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
