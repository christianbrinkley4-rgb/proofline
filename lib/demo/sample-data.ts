/**
 * Sample data for the landing page product demo. Everything here is made up
 * (people, companies, postings) but written to be realistic. Scores are
 * computed with the real rubric so the demo never shows math that doesn't add up.
 */
import { computeFit, type EligibilityGate, type FitComponentKey, type FitPoints } from "@/lib/fit/rubric";

export type WorkMode = "Remote" | "Hybrid" | "Onsite";

export type ComponentDetail = {
  note: string;
  matched: string[];
  missing: string[];
};

export type DemoJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  mode: WorkMode;
  pay: string | null;
  deadline: string;
  source: "Greenhouse" | "Lever";
  posted: string;
  points: FitPoints;
  gates: EligibilityGate[];
  details: Record<FitComponentKey, ComponentDetail>;
  strengths: string[];
  gaps: string[];
};

export const DEMO_QUERY = "accounting internships in Raleigh for summer 2027, remote-friendly";

export const DEMO_INTENT = [
  { label: "Role", value: "Accounting intern" },
  { label: "Where", value: "Raleigh, NC + 50 mi" },
  { label: "When", value: "Summer 2027" },
  { label: "Mode", value: "Remote or hybrid preferred" },
] as const;

export const DEMO_SEARCH_META = {
  matches: 34,
  boards: 212,
  duplicatesMerged: 6,
} as const;

export const DEMO_JOBS: DemoJob[] = [
  {
    id: "whitfield",
    title: "Audit Intern, Summer 2027",
    company: "Whitfield & Lowe LLP",
    location: "Raleigh, NC",
    mode: "Hybrid",
    pay: "$28/hr",
    deadline: "Oct 15",
    source: "Greenhouse",
    posted: "2 days ago",
    points: { requiredSkills: 27, experience: 21, education: 15, preferredSkills: 10, keywords: 9, location: 5 },
    gates: [],
    details: {
      requiredSkills: {
        note: "Covers 5 of their 6 must-haves.",
        matched: ["Account reconciliations", "Excel (pivot tables, XLOOKUP)", "Intermediate Accounting", "Journal entries", "Attention to detail"],
        missing: ["Power BI or Tableau"],
      },
      experience: {
        note: "Your bookkeeping job lines up with audit support work. No audit internship yet.",
        matched: ["Bookkeeping Assistant, Oakwood Family Dental", "VITA tax preparer"],
        missing: ["Audit or assurance experience"],
      },
      education: {
        note: "BS Accounting with a 3.6 clears their 3.0 minimum.",
        matched: ["BS Accounting, NC State", "GPA 3.6 (min 3.0)", "On track for 150 credit hours"],
        missing: [],
      },
      preferredSkills: {
        note: "2 of their 3 nice-to-haves.",
        matched: ["Beta Alpha Psi", "Client-facing experience"],
        missing: ["Auditing coursework"],
      },
      keywords: {
        note: "Your resume already uses 18 of the 20 terms this posting repeats.",
        matched: ["reconciliation", "GAAP", "journal entries", "internal controls"],
        missing: ["substantive testing", "workpapers"],
      },
      location: {
        note: "Raleigh office, 3 days in person. 14 miles from you.",
        matched: ["Hybrid", "Within 50 mi"],
        missing: [],
      },
    },
    strengths: [
      "Reconciliation work with a real dollar result",
      "60 tax returns through VITA, none rejected",
      "Excel skill backed by the bookstore tracker",
    ],
    gaps: ["Power BI or Tableau", "No auditing coursework yet"],
  },
  {
    id: "carrow",
    title: "Tax Associate Intern",
    company: "Carrow Partners",
    location: "Durham, NC",
    mode: "Onsite",
    pay: "$26/hr",
    deadline: "Oct 31",
    source: "Lever",
    posted: "5 days ago",
    points: { requiredSkills: 25, experience: 22, education: 14, preferredSkills: 9, keywords: 7, location: 4 },
    gates: [],
    details: {
      requiredSkills: {
        note: "Covers 5 of their 6 must-haves.",
        matched: ["Individual tax returns", "Excel", "Federal Income Tax", "Client communication", "Deadline-driven work"],
        missing: ["Partnership returns (Form 1065)"],
      },
      experience: {
        note: "VITA is direct tax prep experience, which is rare for a junior.",
        matched: ["VITA tax preparer, 60 returns", "Bookkeeping Assistant"],
        missing: ["Busy season at a firm"],
      },
      education: {
        note: "BS Accounting, 3.6 GPA. They mention Master of Accountancy students first.",
        matched: ["BS Accounting", "GPA 3.6"],
        missing: ["Master of Accountancy track (preferred)"],
      },
      preferredSkills: {
        note: "Some of what they'd like to see.",
        matched: ["IRS certification through VITA", "Beta Alpha Psi"],
        missing: ["CCH Axcess or UltraTax"],
      },
      keywords: {
        note: "15 of the 20 terms this posting repeats.",
        matched: ["individual returns", "tax preparation", "IRS"],
        missing: ["K-1", "tax research"],
      },
      location: {
        note: "Onsite in Durham, 24 miles away. In range, but no remote days.",
        matched: ["Within 50 mi"],
        missing: ["Remote or hybrid option"],
      },
    },
    strengths: [
      "60 returns prepared with zero e-file rejections",
      "Federal Income Tax already completed",
      "Comfortable working face to face with clients",
    ],
    gaps: ["Partnership returns (Form 1065)", "Professional tax software"],
  },
  {
    id: "brightline",
    title: "Accounting Intern, FP&A",
    company: "Brightline Health",
    location: "Remote (US)",
    mode: "Remote",
    pay: "$24/hr",
    deadline: "Nov 8",
    source: "Greenhouse",
    posted: "Yesterday",
    points: { requiredSkills: 20, experience: 17, education: 13, preferredSkills: 9, keywords: 7, location: 5 },
    gates: [],
    details: {
      requiredSkills: {
        note: "Covers 4 of their 6 must-haves.",
        matched: ["Advanced Excel", "Reconciliations", "Financial statements", "Written communication"],
        missing: ["Budget vs. actual analysis", "Power BI"],
      },
      experience: {
        note: "The bookstore tracker is close to FP&A work. Most of your background is bookkeeping and tax.",
        matched: ["Inventory tracker, NC State Bookstores", "Bookkeeping Assistant"],
        missing: ["Forecasting or budgeting"],
      },
      education: {
        note: "Accounting works here. They list finance and economics first.",
        matched: ["BS Accounting", "GPA 3.6"],
        missing: ["Finance or economics coursework"],
      },
      preferredSkills: {
        note: "Some overlap.",
        matched: ["SQL (basic)", "Healthcare setting"],
        missing: ["NetSuite", "Adaptive Planning"],
      },
      keywords: {
        note: "14 of the 20 terms this posting repeats.",
        matched: ["Excel", "month-end", "reporting"],
        missing: ["forecast", "variance", "budget"],
      },
      location: {
        note: "Fully remote in the US, which matches what you asked for.",
        matched: ["Remote", "US work authorization"],
        missing: [],
      },
    },
    strengths: [
      "Built a working Excel model from scratch",
      "Month-end habits from bookkeeping",
      "Remote setup fits your preference",
    ],
    gaps: ["Budgeting and forecasting", "Power BI", "Finance coursework"],
  },
  {
    id: "oakridge",
    title: "Staff Accountant Intern",
    company: "Oakridge Credit Union",
    location: "Cary, NC",
    mode: "Onsite",
    pay: null,
    deadline: "Rolling",
    source: "Lever",
    posted: "3 weeks ago",
    points: { requiredSkills: 22, experience: 18, education: 12, preferredSkills: 6, keywords: 6, location: 4 },
    gates: [],
    details: {
      requiredSkills: {
        note: "Covers 4 of their 5 must-haves.",
        matched: ["Reconciliations", "Excel", "Journal entries", "Accounts payable"],
        missing: ["Loan accounting basics"],
      },
      experience: {
        note: "Bookkeeping maps well. No banking or credit union exposure yet.",
        matched: ["Bookkeeping Assistant"],
        missing: ["Banking or credit union work"],
      },
      education: {
        note: "BS Accounting fits. They'd like to see a banking course.",
        matched: ["BS Accounting"],
        missing: ["Banking coursework (preferred)"],
      },
      preferredSkills: {
        note: "Light overlap.",
        matched: ["Customer service"],
        missing: ["Core banking system", "Spanish"],
      },
      keywords: {
        note: "12 of the 20 terms this posting repeats.",
        matched: ["reconciliation", "accounts payable"],
        missing: ["general ledger", "ACH", "member accounts"],
      },
      location: {
        note: "Onsite in Cary, 9 miles away. No remote days.",
        matched: ["Within 50 mi"],
        missing: ["Remote or hybrid option"],
      },
    },
    strengths: ["Reconciliation and payables experience", "Short commute"],
    gaps: ["Banking systems", "Loan accounting"],
  },
  {
    id: "pellham",
    title: "Revenue Accounting Intern",
    company: "Pellham Software",
    location: "Raleigh, NC",
    mode: "Hybrid",
    pay: "$30/hr",
    deadline: "Oct 20",
    source: "Greenhouse",
    posted: "1 week ago",
    points: { requiredSkills: 24, experience: 18, education: 15, preferredSkills: 8, keywords: 8, location: 5 },
    gates: [{ reason: "Open to students graduating Dec 2026 to Jun 2027. You graduate May 2028.", cap: 40 }],
    details: {
      requiredSkills: {
        note: "Covers 5 of their 6 must-haves.",
        matched: ["Excel", "Reconciliations", "Journal entries", "Intermediate Accounting", "Attention to detail"],
        missing: ["ASC 606 exposure"],
      },
      experience: {
        note: "Bookkeeping is a fair match for revenue support.",
        matched: ["Bookkeeping Assistant"],
        missing: ["Subscription billing"],
      },
      education: {
        note: "Accounting degree fits.",
        matched: ["BS Accounting", "GPA 3.6"],
        missing: [],
      },
      preferredSkills: {
        note: "Light overlap.",
        matched: ["SQL (basic)"],
        missing: ["Salesforce", "NetSuite"],
      },
      keywords: {
        note: "16 of the 20 terms this posting repeats.",
        matched: ["revenue", "reconciliation", "journal entries"],
        missing: ["ASC 606", "deferred revenue"],
      },
      location: {
        note: "Raleigh, hybrid. 6 miles away.",
        matched: ["Hybrid", "Within 50 mi"],
        missing: [],
      },
    },
    strengths: ["Strong match on skills alone"],
    gaps: ["Graduation date is outside their window"],
  },
];

/** Knockouts are shown on their own and never blended into the score. */
export function jobFit(job: DemoJob) {
  return computeFit(job.points);
}

export type DemoKnockout = { key: string; label: string; status: "ok" | "knockout"; reason: string };

/** The four knockout checks for a sample job. `gates` holds the ones this job fails. */
export function jobKnockouts(job: DemoJob): DemoKnockout[] {
  const failing = (word: RegExp) => job.gates.find((gate) => word.test(gate.reason));
  const grad = failing(/graduat/i);
  const auth = failing(/sponsor|citizen|authoriz/i);
  const place = failing(/on-?site|remote|relocat|located/i);
  const start = failing(/start/i);
  return [
    { key: "graduation", label: "Graduation date", status: grad ? "knockout" : "ok", reason: grad?.reason ?? "Your May 2028 graduation fits." },
    { key: "work_authorization", label: "Work authorization", status: auth ? "knockout" : "ok", reason: auth?.reason ?? "No sponsorship or citizenship limits you'd miss." },
    { key: "location", label: "Location and work mode", status: place ? "knockout" : "ok", reason: place?.reason ?? `${job.location}, ${job.mode.toLowerCase()}. Inside where you said you can work.` },
    { key: "start_date", label: "Start date", status: start ? "knockout" : "ok", reason: start?.reason ?? "Starts after you're available." },
  ];
}

/** Cross-job gap insight: the professional development engine in one line. */
export const DEMO_TOP_GAP = {
  skill: "Power BI",
  count: 7,
  saved: 12,
  fix: "Microsoft's free Power BI course, then one dashboard project you can put on your resume.",
} as const;

// Tailored resume

export type ResumeBullet = {
  id: string;
  text: string;
  /** The job requirement this bullet answers, per job id. */
  addresses: Record<string, string>;
  why: string;
  facts: string[];
  /** Pending bullets wait on a yes/no from the user and never export until confirmed. */
  pending?: {
    question: string;
    hours: number;
  };
};

export type ResumeRole = {
  org: string;
  title: string;
  dates: string;
  bullets: ResumeBullet[];
};

export const DEMO_CANDIDATE = {
  name: "Jordan Reyes",
  contact: "Raleigh, NC  ·  jordan@example.com  ·  (919) 555-0142",
  school: "North Carolina State University",
  degree: "Bachelor of Science in Accounting, GPA 3.6",
  grad: "Expected May 2028",
  coursework: "Intermediate Accounting I and II, Federal Income Tax, Cost Accounting",
  skills: "Excel (pivot tables, XLOOKUP), QuickBooks Online, Google Sheets, SQL (basic)",
  profileFacts: { confirmed: 46, toReview: 1 },
} as const;

export const CASH_REPORT_BULLET_ID = "cash-report";

export function cashReportText(hours: number): string {
  return `Saved the office manager about ${hours} hours a week by building a cash report that pulls bank and QuickBooks data into one sheet.`;
}

export const DEMO_EXPERIENCE: ResumeRole[] = [
  {
    org: "Oakwood Family Dental",
    title: "Bookkeeping Assistant (part-time)",
    dates: "May 2025 – Present",
    bullets: [
      {
        id: "reconcile",
        text: "Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments within the first quarter.",
        addresses: {
          whitfield: "Perform account reconciliations",
          carrow: "Strong attention to detail",
          brightline: "Support month-end reconciliations",
          oakridge: "Reconcile general ledger accounts",
        },
        why: "A real dollar result, and every number is confirmed. Your strongest bullet for accounting roles.",
        facts: ["40+ accounts a month", "$3,200 in duplicates", "First quarter", "QuickBooks Online"],
      },
      {
        id: CASH_REPORT_BULLET_ID,
        text: cashReportText(3),
        addresses: {
          whitfield: "Look for ways to improve processes",
          carrow: "Stay organized during busy periods",
          brightline: "Automate recurring reports",
          oakridge: "Improve existing processes",
        },
        why: "Shows you fix things without being asked.",
        facts: ["Weekly cash report", "Bank + QuickBooks data"],
        pending: {
          question: "You said your manager didn't have to piece the cash report together every Friday anymore. Did that save about 3 hours a week?",
          hours: 3,
        },
      },
    ],
  },
  {
    org: "NC State VITA Program",
    title: "Volunteer Tax Preparer",
    dates: "Jan – Apr 2026",
    bullets: [
      {
        id: "vita",
        text: "Prepared 60 federal and state returns as an IRS-certified VITA volunteer, with none rejected at e-file.",
        addresses: {
          whitfield: "Client-facing communication",
          carrow: "Prepare individual tax returns",
          brightline: "Work accurately under deadlines",
          oakridge: "Member service experience",
        },
        why: "Accuracy you can prove: zero rejected returns.",
        facts: ["60 returns", "IRS certified", "0 rejected"],
      },
    ],
  },
  {
    org: "NC State Bookstores",
    title: "Inventory Assistant",
    dates: "Aug 2024 – May 2025",
    bullets: [
      {
        id: "inventory",
        text: "Cut month-end inventory counts from 2 days to 6 hours by building an Excel tracker for 300+ SKUs.",
        addresses: {
          whitfield: "Advanced Excel",
          carrow: "Proficiency in Excel",
          brightline: "Build and maintain Excel models",
          oakridge: "Strong Excel skills",
        },
        why: "Proves Excel skill with an outcome instead of listing it under skills.",
        facts: ["2 days to 6 hours", "300+ SKUs", "Built the tracker"],
      },
    ],
  },
];

export const DEMO_LEADERSHIP: ResumeRole = {
  org: "Beta Alpha Psi",
  title: "Member",
  dates: "Sep 2024 – Present",
  bullets: [
    {
      id: "case-comp",
      text: "Led a 5-person team to 2nd place out of 18 at the Beta Alpha Psi regional case competition.",
      addresses: {
        whitfield: "Work well on a team",
        carrow: "Work well on a team",
        brightline: "Collaborate across teams",
        oakridge: "Works well with others",
      },
      why: "Leadership with a result attached, from a group recruiters know.",
      facts: ["5-person team", "2nd of 18"],
    },
  ],
};

export const DEMO_CUTS = [
  {
    text: "Answered phones and scheduled 30+ patients a day at the front desk.",
    reason: "Front desk work doesn't connect to anything this posting asks for.",
  },
  {
    text: "Tutored 6 classmates in Financial Accounting each semester.",
    reason: "Good bullet, but VITA shows the same people skills plus technical work. It lost the last spot on the page.",
  },
  {
    text: "Organized a 200-person bake sale for Habitat for Humanity.",
    reason: "Saved for nonprofit roles. Here it takes space from your accounting work.",
  },
] as const;

// Tracker

export type TrackerStage = "Saved" | "Applied" | "Assessment" | "Interview" | "Offer";

export type TrackerCard = {
  id: string;
  company: string;
  role: string;
  stage: TrackerStage;
  meta: string;
  flag?: "follow-up" | "due-soon" | "sent";
};

export const TRACKER_STAGES: TrackerStage[] = ["Saved", "Applied", "Assessment", "Interview", "Offer"];

export const TRACKER_CARDS: TrackerCard[] = [
  { id: "t1", company: "Brightline Health", role: "Accounting Intern, FP&A", stage: "Saved", meta: "Deadline Nov 8" },
  { id: "t2", company: "Oakridge Credit Union", role: "Staff Accountant Intern", stage: "Saved", meta: "Rolling deadline" },
  { id: "t3", company: "Whitfield & Lowe LLP", role: "Audit Intern, Summer 2027", stage: "Applied", meta: "Applied today · Resume v1" },
  { id: "t4", company: "Keystone Mutual", role: "Finance Intern", stage: "Applied", meta: "Applied Sep 15", flag: "follow-up" },
  { id: "t5", company: "Marlowe & Tate CPAs", role: "Tax Intern", stage: "Applied", meta: "Applied Sep 18" },
  { id: "t6", company: "Greyson Bank", role: "Accounting Analyst Intern", stage: "Applied", meta: "Applied Sep 10", flag: "sent" },
  { id: "t7", company: "Norland Foods", role: "Audit Intern", stage: "Assessment", meta: "Online test due Sep 26", flag: "due-soon" },
  { id: "t8", company: "Carrow Partners", role: "Tax Associate Intern", stage: "Interview", meta: "First round Sep 30" },
  { id: "t9", company: "Durham Regional Health", role: "Staff Accountant Intern", stage: "Interview", meta: "Final round Oct 2" },
];

export const TRACKER_STATS = [
  { label: "Applications", value: "9" },
  { label: "Response rate", value: "33%" },
  { label: "Interviews", value: "2" },
  { label: "Follow-ups due", value: "1" },
] as const;

export const FOLLOW_UP_DRAFT = {
  to: "Priya Shah, Campus Recruiting",
  company: "Keystone Mutual",
  subject: "Finance Intern application, Jordan Reyes",
  body: [
    "Hi Priya,",
    "I applied for the Finance Intern role on September 15 and wanted to check in. I'm a junior studying accounting at NC State. At my bookkeeping job I reconcile 40+ vendor accounts a month, and I caught $3,200 in duplicate payments in my first quarter.",
    "If there's anything else I can send over, I'm happy to.",
    "Thanks,\nJordan Reyes",
  ],
} as const;
