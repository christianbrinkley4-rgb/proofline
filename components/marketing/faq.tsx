import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Section, SectionHeading } from "./section";

const FAQS = [
  {
    q: "Will it make things up to make me look better?",
    a: "No. Proofline only writes from facts you've confirmed. If it thinks a number would make a bullet stronger, it asks you first. Anything unconfirmed is flagged on screen and can't be exported.",
  },
  {
    q: "Where do the jobs come from?",
    a: "Anywhere you find them. Paste a link from LinkedIn, Indeed, Handshake, or a company site, or paste the description itself when a site needs a sign-in. You can also search employer career sites live from inside Proofline.",
  },
  {
    q: "Does it apply for me?",
    a: "No, and that's on purpose. Every job gets a packet with a cover letter and answers to the form's questions, built from your confirmed facts, plus the link and deadline. You stay in control of what gets sent and when.",
  },
  {
    q: "Will my resume get through applicant tracking systems?",
    a: "Resumes export as clean one-page DOCX and PDF files with standard headings and simple formatting, which is what those systems read best. Your fit score also shows which terms from the posting you're missing.",
  },
  {
    q: "Can I use my own AI?",
    a: "Yes. Connect Claude, Cursor, or another app that supports MCP from Settings. It gets the same tools and the same rules: anything it learns about you waits for your confirmation, and it can't send or submit anything.",
  },
  {
    q: "Who is it for right now?",
    a: "Built first for students and recent grads, but you don't need to be in college to use it. Add paid work, projects, volunteering, training, or other experience, then search for roles and see where your evidence fits. Live job coverage is strongest in our current fields; you can paste a posting from any field.",
  },
  {
    q: "What does it cost?",
    a: "Nothing during the beta. If that changes, you'll get at least 30 days' notice and can export everything you've built.",
  },
];

export function Faq() {
  return (
    <Section id="faq">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <SectionHeading eyebrow="FAQ" title="Questions people ask first." />
        <Accordion type="single" collapsible defaultValue="item-0" className="border-t">
          {FAQS.map((item, i) => (
            <AccordionItem key={item.q} value={`item-${i}`} className="border-b">
              <AccordionTrigger className="py-4 text-[15px] hover:no-underline">{item.q}</AccordionTrigger>
              <AccordionContent className="pb-5 text-[15px] leading-7 text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
