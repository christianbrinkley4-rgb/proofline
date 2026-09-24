export type JobSource = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workday" | "themuse" | "adzuna" | "usajobs" | "himalayas" | "jobicy" | "link";
export type JobMode = "remote" | "hybrid" | "onsite" | "unknown";
export type JobLevel = "internship" | "entry" | "experienced" | "unknown";

/** One posting in the shape every source maps into. */
export type NormalizedJob = {
  source: JobSource;
  sourceId: string;
  company: string;
  title: string;
  location: string | null;
  mode: JobMode;
  level: JobLevel;
  url: string;
  /** Plain text. Null when the listing endpoint didn't include it; fetched on demand. */
  description: string | null;
  department: string | null;
  employmentType: string | null;
  payMin: number | null;
  payMax: number | null;
  payPeriod: "hour" | "year" | null;
  postedAt: Date | null;
};

export type JobIntent = {
  /** What the student typed. */
  query: string;
  /** Role words to match in titles, e.g. ["accounting", "audit"]. */
  roles: string[];
  level: "internship" | "entry" | "any";
  /** e.g. "Summer 2027" */
  term: string | null;
  /** Place names as typed, normalized, e.g. ["Raleigh, NC"]. */
  locations: string[];
  modes: Array<"remote" | "hybrid" | "onsite">;
  /** Words or requirements to avoid, e.g. ["sales"], ["cpa"]. */
  exclude: string[];
  /** Minimum pay in dollars, with its period. */
  payFloor: { amount: number; period: "hour" | "year" } | null;
};

export type SearchProgress =
  | { type: "intent"; intent: JobIntent }
  | { type: "status"; message: string }
  | { type: "source"; source: string; found: number }
  | { type: "done"; stats: SearchStats };

export type SearchStats = {
  boardsSearched: number;
  sourcesSearched: number;
  scanned: number;
  matched: number;
  duplicatesMerged: number;
  /** Aggregator postings skipped for being too old to still be open. */
  staleDropped?: number;
  ms: number;
};
