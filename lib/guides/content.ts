/**
 * Guides for people writing a resume, in Proofline's voice: specific, plain, and
 * sourced. Every factual claim links to where it came from, and a survey result is
 * described as what it is (what people said, not a measured rate). The site copy
 * test runs the voice rules over this file.
 */

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "examples"; items: Array<{ role: string; before: string; after: string; how: string }> };

export type Guide = {
  slug: string;
  title: string;
  description: string;
  updated: string;
  minutes: number;
  sections: Array<{ heading: string; blocks: GuideBlock[] }>;
  sources: Array<{ label: string; url: string }>;
};

export const GUIDES: Guide[] = [
  {
    slug: "quantify-resume-bullets",
    title: "How to put a number on a bullet when you think you don't have one",
    description: "Most jobs, classes, and clubs have numbers in them. Where to find yours, and how to keep every one of them true.",
    updated: "2026-09-28",
    minutes: 5,
    sections: [
      {
        heading: "Why a number helps",
        blocks: [
          { kind: "p", text: "A number tells a reader how big your work was. \"Tutored students\" could mean one friend or a full caseload. \"Tutored 6 students a week\" can't be misread." },
          { kind: "p", text: "It also gives the interviewer something to ask about. That's good, as long as you can answer. Every number below passes one test: if someone asks \"how do you know?\", you have a one-sentence answer." },
        ],
      },
      {
        heading: "Five places numbers hide",
        blocks: [
          {
            kind: "list",
            items: [
              "How many: customers, students, accounts, orders, shelves, volunteers, pages, lines of code.",
              "How often: per shift, per week, per month, every semester.",
              "How much: dollars handled, hours saved, items in inventory, the size of a budget.",
              "Before and after: from 2 days to 6 hours, from 12 errors a month to 3.",
              "Out of how many: 2nd of 18 teams, one of 4 students picked, the only person trained on the system.",
            ],
          },
        ],
      },
      {
        heading: "What it looks like",
        blocks: [
          {
            kind: "examples",
            items: [
              {
                role: "Cashier",
                before: "Handled customer checkout",
                after: "Checked out about 150 customers a shift and balanced a $2,000 drawer with no shortages",
                how: "The register counts transactions, and your drawer count is on the closing sheet.",
              },
              {
                role: "Tutor",
                before: "Tutored students in math",
                after: "Tutored 6 students a week in Algebra I; 4 raised a unit test grade by a letter",
                how: "Your schedule shows the six, and the students told you their grades.",
              },
              {
                role: "Club officer",
                before: "Organized events for the club",
                after: "Organized 3 speaker nights for a 40-member club; 55 people came to the largest",
                how: "You kept the sign-in sheet.",
              },
              {
                role: "Class project",
                before: "Worked on a data analysis project",
                after: "Cleaned 12,000 rows of city bike data in Python and found the 3 stations that ran out of bikes most",
                how: "The row count and the result are in your notebook.",
              },
            ],
          },
        ],
      },
      {
        heading: "Rules that keep it true",
        blocks: [
          {
            kind: "list",
            items: [
              "Count what you can explain. If you can't say where a number came from, leave it out.",
              "When you estimate, say \"about\" and round down. \"About 150 a shift\" is fine if you can explain the average.",
              "Never let a tool add a number for you. If software suggests \"increased efficiency by 30%\" and you never measured it, it's not yours.",
              "No number at all? Show scale in words: \"for the whole front desk\", \"used by every new hire\".",
            ],
          },
          { kind: "p", text: "Proofline works this way on purpose. When a bullet has no number, it asks you for one instead of making one up, and it blocks a download if a line has a number you never confirmed." },
        ],
      },
    ],
    sources: [],
  },
  {
    slug: "ats-myths",
    title: "The ATS myths that make resumes worse",
    description: "Applicant tracking systems mostly store and sort applications. The rejections that are automatic come from questions the employer set, not a robot grading your fonts.",
    updated: "2026-09-28",
    minutes: 5,
    sections: [
      {
        heading: "Where \"75% of resumes are rejected by ATS\" came from",
        blocks: [
          {
            kind: "p",
            text: "The figure traces back to Preptel, a company that sold resume-optimization software around 2012. Preptel shut down in 2013 and never published a study, a data set, or a method behind the number. It has been repeated ever since, which is also why you see it as 70, 75, or 88 percent.",
          },
        ],
      },
      {
        heading: "What an applicant tracking system actually does",
        blocks: [
          {
            kind: "list",
            items: [
              "Stores every application in one place so a recruiter can find it later.",
              "Lets recruiters search and sort, often by the words in a posting.",
              "Asks the knockout questions the employer chose: work authorization, a required license, a location, a start date. A wrong answer there can end an application automatically. Those are the automatic rejections that really happen.",
            ],
          },
          { kind: "p", text: "After that, a person reads. That's who you're writing for." },
        ],
      },
      {
        heading: "Three myths that backfire",
        blocks: [
          {
            kind: "list",
            items: [
              "\"Put in every keyword from the posting.\" Use the posting's words for things you've actually done, since recruiters search that way. A keyword you can't back up becomes an interview question you can't answer.",
              "\"A higher match score means the ATS will pass you.\" Scanner scores are made by the scanner's company, not the employer. Jobscan, the best known, says so itself: the ATS doesn't score your resume, and its match rate is a tool for preparing.",
              "\"Any two-column or designed template gets thrown out.\" Modern systems read most text-based files. Keep it to one column with standard headings anyway: it parses everywhere, and a recruiter's first look is short. In Ladders' eye-tracking study it averaged 7.4 seconds.",
            ],
          },
        ],
      },
      {
        heading: "What to do instead",
        blocks: [
          {
            kind: "list",
            items: [
              "Answer knockout questions truthfully. If you can't meet one, that job isn't the one to spend an evening on.",
              "Use the posting's words for skills you have and can explain.",
              "Send a text-based PDF or a DOCX with one column and standard section headings.",
              "Write for the person who reads it next: specific, true, and easy to skim.",
            ],
          },
        ],
      },
    ],
    sources: [
      { label: "Uncharted Career: the 75% auto-rejection myth, traced to its source", url: "https://unchartedcareer.com/blog/the-75-of-resumes-are-auto-rejected-myth-traced-to-its-source" },
      { label: "Jobscan resume scanner (on what its score is and isn't)", url: "https://www.jobscan.co/resume-scanner" },
      { label: "Ladders eye-tracking study (2018)", url: "https://www.theladders.com/static/images/basicSite/pdfs/TheLadders-EyeTracking-StudyC2.pdf" },
      { label: "HR Dive summary of the eye-tracking study", url: "https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/" },
    ],
  },
  {
    slug: "ai-resume-tells",
    title: "Can recruiters tell your resume was written by AI?",
    description: "Most hiring managers say they can. What they notice isn't the tool; it's vague, inflated, generic writing. Here's how to use AI without it.",
    updated: "2026-09-28",
    minutes: 4,
    sections: [
      {
        heading: "What hiring managers say",
        blocks: [
          {
            kind: "p",
            text: "In a March 2026 Resume Genius survey of 1,000 U.S. hiring managers, 80% said they can identify an AI-written resume at a glance, and 76% said AI-written resumes make it harder to understand what a candidate actually did. That's what they believe, not a measured accuracy rate. But it's the reader you have.",
          },
        ],
      },
      {
        heading: "The tells they named",
        blocks: [
          {
            kind: "list",
            items: [
              "Unnatural phrasing or tone: 51%.",
              "Repetitive or generic language: 44%.",
              "Vague or inflated descriptions: 41%.",
              "Heavy use of buzzwords: 41%.",
              "Formatting habits such as long dashes: 32%.",
            ],
          },
          { kind: "p", text: "Nearly every item on that list is about content, not the tool. A resume you wrote yourself full of stock phrases reads the same way." },
        ],
      },
      {
        heading: "How to use AI without the tells",
        blocks: [
          {
            kind: "list",
            items: [
              "Start from what you actually did, in your own words, and ask for help with wording, not with content.",
              "Keep your specifics: the tool, the number, the place. Those are what generic text loses first.",
              "Refuse any number you didn't give it. If it wrote \"boosted engagement 40%\", delete it or replace it with something you counted.",
              "Vary the shape. Not every line needs to be verb, task, percent.",
              "Read it out loud. If you wouldn't say it in an interview, rewrite it.",
            ],
          },
          { kind: "p", text: "That's the idea behind Proofline: it only writes from facts you've confirmed and checks every number against them before you can download the page." },
        ],
      },
    ],
    sources: [{ label: "Resume Genius, 2026 Hiring Insights Report (1,000 U.S. hiring managers, March 2026)", url: "https://resumegenius.com/blog/job-hunting/hiring-insights-report" }],
  },
];

export function guide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
