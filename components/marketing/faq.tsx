import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Section, SectionHeading } from "./section";

const FAQS = [
  {
    q: "Will it make things up to make me look better?",
    a: "No. Proofline only writes from what you've confirmed. If it thinks a number would make a bullet stronger, it asks you first. Anything unconfirmed is flagged on screen and can't be exported.",
  },
  {
    q: "How is this different from other resume builders or ChatGPT?",
    a: "Most tools write whatever sounds strongest, including numbers you never gave them, and some send applications for you. Proofline writes only from what you've confirmed, checks every number against them, and leaves applying to you. You get fewer, better applications, and you can answer any question about your own resume.",
  },
  {
    q: "Where do the jobs come from?",
    a: "Anywhere you find them. Paste a link from LinkedIn, Indeed, Handshake, or a company site, or paste the description itself when a site needs a sign-in.",
  },
  {
    q: "How many resumes do I get per job?",
    a: "One: the best version for that posting, made from what you've confirmed. If the posting asks for something you haven't shown, Proofline asks you about it instead of guessing.",
  },
  {
    q: "Does it apply for me?",
    a: "No, and that's on purpose. You download the resume, apply on the employer's site, and track it on your board. You stay in control of what gets sent and when.",
  },
  {
    q: "Will my resume get through applicant tracking systems?",
    a: "Resumes export as clean one-page DOCX and PDF files with standard headings and simple formatting, which is what those systems read best. Your fit score also shows which terms from the posting you're missing.",
  },
  {
    q: "Who is it for right now?",
    a: "Anyone who wants to try the beta. It's built first for students and recent grads, but paid work, projects, volunteering, and training all count.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. It's free during the beta.",
  },
  {
    q: "What happens to my data?",
    a: "It's yours. You can download all of it or delete your account and everything in it from Settings at any time.",
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
