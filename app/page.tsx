import { BulletWalkthrough } from "@/components/marketing/bullet-walkthrough";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { Loop } from "@/components/marketing/loop";
import { Pricing } from "@/components/marketing/pricing";
import { Principles } from "@/components/marketing/principles";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Loop />
        <Principles />
        <BulletWalkthrough />
        <Pricing />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
