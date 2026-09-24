import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Section, SectionHeading } from "./section";

const FAQS = [
  {
    q: "Will it make things up to make me look better?",
    a: "No. Proofline only writes from facts you've confirmed. If it thinks a number would make a bullet stronger, it asks you first. Anything unconfirmed is flagged on screen and can't be exported.",
  },
  {
    q: "Where do the jobs come from?",
    a: "Straight from employers: company job boards on Greenhouse, Lever, Ashby, and SmartRecruiters, large employers' own career sites, and The Muse. Duplicates are merged so each opening shows up once, and stale listings are skipped.",
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
    a: "Students and recent grads going after internships and entry-level roles in accounting, finance, business, and tech. More fields are coming.",
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
