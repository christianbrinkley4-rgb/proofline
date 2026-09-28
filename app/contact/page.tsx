import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { container } from "@/components/marketing/section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className={`${container} max-w-2xl py-16 sm:py-24`}>
          <h1 className="font-display text-[36px] leading-tight font-semibold sm:text-[46px]">Talk to us</h1>
          <p className="mt-4 text-[16px] leading-7 text-muted-foreground">
            A question about the private beta, a school or career center that wants to try it, or anything else. Leave your email and
            we&apos;ll write back.
          </p>
          <div className="mt-10">
            <ContactForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
