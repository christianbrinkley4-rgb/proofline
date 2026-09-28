/**
 * Action verbs for bullet openers, grouped by what the bullet proves.
 * Past tense; bullets for a current role may use present tense consistently.
 * Sources: Harvard career services verb lists and the research in
 * docs/research/RESUME-STANDARDS.md.
 */
export const ACTION_VERBS = {
  leadership: [
    "Led", "Directed", "Managed", "Supervised", "Coordinated", "Organized", "Mentored", "Trained", "Recruited",
    "Delegated", "Chaired", "Headed", "Founded", "Launched", "Guided", "Mobilized", "Captained", "Oversaw",
  ],
  analysis: [
    "Analyzed", "Assessed", "Audited", "Calculated", "Compared", "Evaluated", "Examined", "Forecasted", "Identified",
    "Investigated", "Measured", "Modeled", "Projected", "Quantified", "Researched", "Reviewed", "Surveyed", "Tested",
    "Tracked", "Validated", "Verified", "Diagnosed", "Mapped", "Read", "Cleaned",
  ],
  finance: [
    "Reconciled", "Prepared", "Filed", "Budgeted", "Allocated", "Balanced", "Billed", "Collected", "Posted",
    "Processed", "Recorded", "Reported", "Invoiced", "Priced", "Valued", "Accrued", "Closed", "Disbursed",
    "Consolidated", "Estimated",
  ],
  building: [
    "Built", "Created", "Designed", "Developed", "Drafted", "Engineered", "Established", "Implemented", "Introduced",
    "Programmed", "Wrote", "Contributed", "Produced", "Prototyped", "Configured", "Automated", "Deployed", "Coded", "Authored", "Architected", "Operated",
  ],
  improvement: [
    "Cut", "Reduced", "Increased", "Improved", "Raised", "Grew", "Doubled", "Tripled", "Accelerated", "Expanded",
    "Lowered", "Shortened", "Simplified", "Standardized", "Streamlined", "Upgraded", "Modernized", "Consolidated",
    "Eliminated", "Recovered", "Saved", "Boosted", "Restructured", "Revamped", "Resolved", "Fixed", "Caught",
    "Prevented", "Converted", "Drove",
  ],
  communication: [
    "Presented", "Pitched", "Negotiated", "Persuaded", "Advised", "Briefed", "Explained", "Taught", "Tutored",
    "Translated", "Edited", "Published", "Interviewed", "Facilitated", "Hosted", "Moderated", "Corresponded", "Wrote",
  ],
  service: [
    "Served", "Assisted", "Supported", "Provided", "Answered", "Resolved", "Handled", "Welcomed", "Scheduled", "Greeted",
    "Onboarded", "Counseled", "Guided", "Responded", "Escorted",
  ],
  achievement: [
    "Won", "Earned", "Placed", "Achieved", "Completed", "Exceeded", "Surpassed", "Secured", "Awarded", "Ranked",
    "Delivered", "Finished", "Qualified", "Passed", "Performed",
  ],
  organization: [
    "Arranged", "Cataloged", "Compiled", "Maintained", "Monitored", "Planned", "Prioritized", "Scheduled",
    "Sorted", "Systematized", "Inventoried", "Organized", "Logged", "Documented", "Updated", "Counted", "Checked", "Booked",
    "Received", "Distributed", "Sent", "Transmitted",
  ],
} as const;

export type VerbCategory = keyof typeof ACTION_VERBS;

const ALL = new Set<string>(Object.values(ACTION_VERBS).flat().map((v) => v.toLowerCase()));

/**
 * Words that read as filler or as AI-written. Not wrong, but recruiters flag them
 * when they stack up. We warn; the user decides.
 */
export const OVERUSED_VERBS = new Set([
  "spearheaded", "utilized", "leveraged", "orchestrated", "fostered", "championed", "synergized", "facilitated",
  "pioneered", "drove",
]);

/** Weak openers and the stronger verbs to suggest in their place. */
export const WEAK_OPENER_SWAPS: Record<string, string[]> = {
  "responsible for": ["Managed", "Oversaw", "Handled"],
  "was responsible for": ["Managed", "Oversaw", "Handled"],
  helped: ["Supported", "Contributed to", "Assisted"],
  "helped with": ["Supported", "Contributed to"],
  "worked on": ["Built", "Developed", "Contributed to"],
  ran: ["Managed", "Operated", "Led"],
  made: ["Built", "Created", "Designed"],
  did: ["Completed", "Performed", "Prepared"],
  handled: ["Managed", "Processed", "Resolved"],
  got: ["Earned", "Secured", "Won"],
  "sat in": ["Observed", "Attended", "Shadowed"],
  "sat in on": ["Observed", "Shadowed"],
  "tasked with": ["Managed", "Delivered"],
  "participated in": ["Contributed to", "Competed in", "Joined"],
  "assisted with": ["Supported", "Prepared"],
  turn: ["Converted", "Transformed"],
  turned: ["Converted", "Transformed"],
};

export function isActionVerb(word: string): boolean {
  return ALL.has(word.toLowerCase().replace(/[^a-z]/g, ""));
}

export function verbCategory(word: string): VerbCategory | null {
  const w = word.toLowerCase();
  for (const [category, verbs] of Object.entries(ACTION_VERBS)) {
    if ((verbs as readonly string[]).some((v) => v.toLowerCase() === w)) return category as VerbCategory;
  }
  return null;
}

/** Suggestions for replacing a bullet's first word, same category first. */
export function suggestVerbs(firstWord: string, avoid: Iterable<string> = [], limit = 4): string[] {
  const used = new Set([...avoid].map((w) => w.toLowerCase()));
  const swaps = WEAK_OPENER_SWAPS[firstWord.toLowerCase()];
  if (swaps) return swaps.filter((v) => !used.has(v.toLowerCase())).slice(0, limit);
  const category = verbCategory(firstWord) ?? "improvement";
  return ACTION_VERBS[category].filter((v) => v.toLowerCase() !== firstWord.toLowerCase() && !used.has(v.toLowerCase())).slice(0, limit);
}
