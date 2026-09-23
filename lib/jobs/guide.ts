import type { Requirements } from "@/lib/fit/requirements";
import type { JobRow } from "./store";

/**
 * "Exactly how to apply": a concrete checklist for one posting, read from the
 * posting itself and from what we know about the site it's on.
 */
export type GuideStep = { id: string; label: string; detail: string; href?: string };

const PORTAL: Record<string, { name: string; account: string }> = {
  greenhouse: { name: "Greenhouse", account: "No account needed. It's one page and usually takes about 10 minutes." },
  lever: { name: "Lever", account: "No account needed. One page, and you can attach your resume directly." },
  ashby: { name: "Ashby", account: "No account needed. One page with a resume upload." },
  smartrecruiters: { name: "SmartRecruiters", account: "No account needed, though you can sign in to save your progress." },
  workday: { name: "Workday", account: "Workday asks you to create an account on this company's site. Use the same email for every Workday employer so you can track them." },
  themuse: { name: "the employer's site", account: "The link goes to the employer's own application. Some ask you to create an account." },
  adzuna: { name: "the employer's site", account: "The link goes to the original posting. Some employers ask you to create an account." },
  usajobs: { name: "USAJOBS", account: "You'll need a USAJOBS account (Login.gov). Federal applications take longer, so start early." },
  link: { name: "the page you pasted", account: "Check whether the site asks you to sign in before you start." },
};

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

export function findDeadline(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(new RegExp(`(?:apply by|deadline|applications? (?:are |is )?(?:due|close|accepted until)|closes?|closing date)[:\\s]+(?:on\\s+)?(${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*20\\d{2})?)`, "i"));
  return m ? m[1] : null;
}

export function applicationGuide(job: JobRow, req: Requirements, school?: string | null): GuideStep[] {
  const text = job.description ?? "";
  const portal = PORTAL[job.source] ?? PORTAL.link;
  const steps: GuideStep[] = [];

  steps.push({ id: "apply", label: `Apply on ${portal.name}`, detail: portal.account, href: job.url });

  const materials = ["Your tailored one-page resume (PDF)"];
  if (/cover letter/i.test(text)) materials.push(/cover letter[^.\n]{0,40}(optional|encouraged)/i.test(text) ? "A cover letter (optional here, but a short specific one helps)" : "A cover letter (they ask for one)");
  if (/transcript/i.test(text)) materials.push("An unofficial transcript");
  if (/writing sample/i.test(text)) materials.push("A writing sample");
  if (/portfolio|github/i.test(text)) materials.push("A portfolio or GitHub link");
  if (/references?\b/i.test(text) && /provide|submit|list/i.test(text)) materials.push("References");
  steps.push({ id: "materials", label: "Have these ready", detail: materials.join(". ") + "." });

  const questions: string[] = [];
  if (req.noSponsorship || /authoriz|sponsor/i.test(text)) questions.push("work authorization and sponsorship");
  if (req.gradWindow || job.level === "internship") questions.push("your graduation date");
  if (req.minGpa != null) questions.push(`your GPA (they list ${req.minGpa} as a minimum)`);
  if (job.level === "internship") questions.push("which dates you're available");
  questions.push(`a short "why ${job.company}" answer`);
  steps.push({ id: "questions", label: "Expect questions about", detail: `${capitalize(questions.join(", "))}. Your agent can draft the short answers from your profile.` });

  const deadline = findDeadline(text);
  steps.push({
    id: "deadline",
    label: deadline ? `Apply by ${deadline}` : "Apply early",
    detail: deadline
      ? "Many employers review on a rolling basis, so sooner beats the deadline."
      : "No deadline listed. Internship postings often close once they have enough applicants, so aim for this week.",
  });

  steps.push({
    id: "referral",
    label: "Find a referral",
    detail: school
      ? `Search LinkedIn for ${school} alumni at ${job.company}. A short, specific message asking for 15 minutes can get your application read by a person.`
      : `Search LinkedIn for people at ${job.company} in this team. A short, specific message can get your application read by a person.`,
  });

  return steps;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
