import type { Metadata } from "next";
import Link from "next/link";
import { container } from "@/components/marketing/section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { PRIVACY_POINTS } from "@/lib/privacy";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className={`${container} max-w-2xl py-16 sm:py-24`}>
          <h1 className="font-display text-[36px] leading-tight font-semibold sm:text-[46px]">Your data is yours</h1>
          <ul className="mt-8 space-y-5">
            {PRIVACY_POINTS.map((point) => (
              <li key={point.title}>
                <h2 className="text-[16px] font-semibold">{point.title}</h2>
                <p className="mt-1 text-[15px] leading-7 text-muted-foreground">{point.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-[14px] text-muted-foreground">
            Questions? <Link href="/contact" className="font-medium text-foreground underline underline-offset-4">Write to us</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
