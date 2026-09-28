import { BulletWalkthrough } from "@/components/marketing/bullet-walkthrough";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { CoachBand } from "@/components/marketing/coach-band";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { ProofVs } from "@/components/marketing/proof-vs";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Walkthrough } from "@/components/marketing/walkthrough";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Walkthrough />
        <CoachBand />
        <BulletWalkthrough />
        <ProofVs />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
