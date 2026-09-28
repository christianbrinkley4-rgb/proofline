import { extractSkills } from "./skills";

/**
 * Small, real ways to earn a skill a posting asks for, keyed by the canonical
 * names in skills.ts. Each one ends in something the person can describe in their
 * own words, which is how it becomes a fact: they answer the gap question after
 * doing it. Resources are free and come from the tool's maker or a long-standing
 * public source. Soft skills, paid credentials, and enterprise systems students
 * can't get into are left out on purpose: a project can't honestly earn those.
 */

export type EarnPath = {
  skill: string;
  /** What to build or do, in one sentence. */
  project: string;
  /** An honest range for a first try. */
  time: string;
  resource: { name: string; url: string } | null;
};

const ACCOUNTING_COACH = { name: "AccountingCoach (free explanations and quizzes)", url: "https://www.accountingcoach.com/" };
const EXCEL_TRAINING = { name: "Microsoft Excel help and training", url: "https://support.microsoft.com/en-us/excel" };

const PATHS: Record<string, Omit<EarnPath, "skill">> = {
  "Account reconciliation": {
    project: "Reconcile one month of a bank statement against a ledger in Excel: list outstanding checks and deposits in transit, and tie out to the bank balance.",
    time: "2 to 4 hours",
    resource: ACCOUNTING_COACH,
  },
  "Journal entries": {
    project: "Record a month of transactions for a made-up small business as journal entries, then post them to T-accounts and check that debits equal credits.",
    time: "3 to 5 hours",
    resource: ACCOUNTING_COACH,
  },
  "General ledger": {
    project: "Build a small general ledger in Excel from 30 or more journal entries and produce a trial balance that ties out.",
    time: "3 to 5 hours",
    resource: ACCOUNTING_COACH,
  },
  "Accounts payable": {
    project: "Set up a vendor bill log in QuickBooks Online's free sample company: enter bills, pay them, and run an aging report.",
    time: "2 to 3 hours",
    resource: { name: "QuickBooks Online sample company (test drive)", url: "https://qbo.intuit.com/redir/testdrive" },
  },
  "Accounts receivable": {
    project: "In QuickBooks Online's free sample company, create invoices, record payments, and run an A/R aging report.",
    time: "2 to 3 hours",
    resource: { name: "QuickBooks Online sample company (test drive)", url: "https://qbo.intuit.com/redir/testdrive" },
  },
  "Month-end close": {
    project: "Write a month-end close checklist for a small business and run it once on sample data: reconciliations, accruals, and a trial balance.",
    time: "3 to 5 hours",
    resource: ACCOUNTING_COACH,
  },
  "Financial statements": {
    project: "Take a public company's latest 10-K from SEC EDGAR and rebuild its income statement and balance sheet in Excel, with three ratios explained.",
    time: "3 to 6 hours",
    resource: { name: "SEC EDGAR company filings", url: "https://www.sec.gov/edgar/search/" },
  },
  "Tax preparation": {
    project: "Earn the IRS's free Link & Learn Taxes certification, then volunteer a season with a VITA site.",
    time: "10 to 20 hours to certify",
    resource: { name: "IRS Link & Learn Taxes", url: "https://www.irs.gov/individuals/link-learn-taxes" },
  },
  QuickBooks: {
    project: "Use QuickBooks Online's free sample company to enter a week of transactions, reconcile the bank account, and run a profit and loss report.",
    time: "2 to 4 hours",
    resource: { name: "QuickBooks Online sample company (test drive)", url: "https://qbo.intuit.com/redir/testdrive" },
  },
  Excel: {
    project: "Turn a year of real or public data into a workbook with a pivot table, an XLOOKUP, and one chart that answers a question.",
    time: "2 to 4 hours",
    resource: EXCEL_TRAINING,
  },
  "Budgeting and forecasting": {
    project: "Build a 12-month budget in Excel for a club or a made-up business, then compare three months of actuals and explain the biggest variance.",
    time: "3 to 5 hours",
    resource: EXCEL_TRAINING,
  },
  "Variance analysis": {
    project: "Compare a budget with actuals for one quarter in Excel and write two sentences on each variance over 10%.",
    time: "2 to 3 hours",
    resource: EXCEL_TRAINING,
  },
  "Financial modeling": {
    project: "Build a simple three-statement model for a public company from its latest 10-K, with revenue growth as the one input you change.",
    time: "6 to 10 hours",
    resource: { name: "SEC EDGAR company filings", url: "https://www.sec.gov/edgar/search/" },
  },
  SQL: {
    project: "Load a public dataset and answer ten questions about it with SQL, using joins and GROUP BY. Keep the queries in a file you can show.",
    time: "4 to 6 hours",
    resource: { name: "SQLBolt (free interactive lessons)", url: "https://sqlbolt.com/" },
  },
  Python: {
    project: "Write a script that cleans a messy CSV and prints a short summary, and put it on GitHub with a README.",
    time: "6 to 10 hours",
    resource: { name: "Python for Everybody (free course)", url: "https://www.py4e.com/" },
  },
  Tableau: {
    project: "Publish one dashboard on Tableau Public that answers a single question about a public dataset.",
    time: "3 to 5 hours",
    resource: { name: "Tableau Public", url: "https://public.tableau.com/" },
  },
  "Power BI": {
    project: "Build one Power BI report from a public dataset with two visuals and a filter, and export it to PDF to show.",
    time: "3 to 5 hours",
    resource: { name: "Microsoft Power BI documentation", url: "https://learn.microsoft.com/en-us/power-bi/" },
  },
  "Data analysis": {
    project: "Pick a public dataset, ask one question, and answer it in a one-page write-up with a chart and the steps you took.",
    time: "3 to 5 hours",
    resource: EXCEL_TRAINING,
  },
  Statistics: {
    project: "Work through a statistics unit, then run a simple regression on a public dataset and explain what the result does and doesn't show.",
    time: "6 to 10 hours",
    resource: { name: "Khan Academy statistics and probability", url: "https://www.khanacademy.org/math/statistics-probability" },
  },
  Git: {
    project: "Put a class or personal project on GitHub with a README and at least ten meaningful commits.",
    time: "2 to 3 hours",
    resource: { name: "Pro Git (free book)", url: "https://git-scm.com/book/en/v2" },
  },
  JavaScript: {
    project: "Build a small web page that fetches data and updates without reloading, and publish it with GitHub Pages.",
    time: "8 to 12 hours",
    resource: { name: "MDN Learn web development", url: "https://developer.mozilla.org/en-US/docs/Learn" },
  },
  React: {
    project: "Build a small React app with two screens and a form, following the official tutorial, and publish it.",
    time: "8 to 12 hours",
    resource: { name: "React: Learn", url: "https://react.dev/learn" },
  },
  AWS: {
    project: "Take the free AWS Cloud Practitioner Essentials course, then host a static site in S3.",
    time: "6 to 10 hours",
    resource: { name: "AWS Skill Builder", url: "https://skillbuilder.aws/" },
  },
  Salesforce: {
    project: "Complete a beginner Trailhead trail and build a simple custom object with a report in a free Developer Edition org.",
    time: "4 to 8 hours",
    resource: { name: "Salesforce Trailhead", url: "https://trailhead.salesforce.com/" },
  },
  HubSpot: {
    project: "Earn a free HubSpot Academy certification, such as Inbound Marketing.",
    time: "4 to 6 hours",
    resource: { name: "HubSpot Academy", url: "https://academy.hubspot.com/" },
  },
  Marketing: {
    project: "Run one small campaign for a club or local group: set a goal, post on a schedule, and report what changed.",
    time: "2 to 4 weeks, a little each day",
    resource: { name: "HubSpot Academy", url: "https://academy.hubspot.com/" },
  },
  "Google Analytics": {
    project: "Earn the free Google Analytics certification, then set up GA4 on a personal site and read one week of data.",
    time: "4 to 6 hours",
    resource: { name: "Google Skillshop", url: "https://skillshop.withgoogle.com/" },
  },
  "Project management": {
    project: "Run one small project end to end, like a club event: a written plan, a timeline, weekly check-ins, and a short recap of what happened.",
    time: "2 to 6 weeks",
    resource: null,
  },
  Figma: {
    project: "Redesign one screen of an app you use in Figma, with a before and after and a short note on why.",
    time: "3 to 5 hours",
    resource: { name: "Figma Learn", url: "https://help.figma.com/hc/en-us" },
  },
};

/** The path for a skill as a posting names it ("Excel (pivot tables)", "QuickBooks Online"), if there is an honest one. */
export function earnPath(skill: string): EarnPath | null {
  const names = [skill, ...extractSkills(skill)];
  for (const name of names) {
    const path = PATHS[name];
    if (path) return { skill: name, ...path };
  }
  return null;
}

/** Every skill with a path, for tests and docs. */
export const EARNABLE_SKILLS = Object.keys(PATHS);
