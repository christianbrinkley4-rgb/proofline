import type { BoardRef } from "./sources/boards";
import type { WorkdayRef } from "./sources/search-apis";

/**
 * Employer boards we search directly. Every entry was checked live against its
 * public API (September 2026). Add employers freely: a bad slug just returns nothing.
 *
 * tags steer which boards a search hits first: finance, accounting, fintech, tech,
 * trading, consulting, consumer, health, energy.
 */

type Tagged<T> = T & { tags: string[] };

export const BOARDS: Array<Tagged<BoardRef>> = [
  // Fintech and finance-heavy (lots of accounting, FP&A, and treasury roles)
  { source: "greenhouse", slug: "stripe", company: "Stripe", tags: ["fintech", "finance", "accounting", "tech"] },
  { source: "greenhouse", slug: "brex", company: "Brex", tags: ["fintech", "finance", "accounting"] },
  { source: "greenhouse", slug: "affirm", company: "Affirm", tags: ["fintech", "finance"] },
  { source: "greenhouse", slug: "robinhood", company: "Robinhood", tags: ["fintech", "finance", "trading"] },
  { source: "greenhouse", slug: "coinbase", company: "Coinbase", tags: ["fintech", "finance", "tech"] },
  { source: "greenhouse", slug: "sofi", company: "SoFi", tags: ["fintech", "finance", "banking"] },
  { source: "greenhouse", slug: "chime", company: "Chime", tags: ["fintech", "finance"] },
  { source: "greenhouse", slug: "carta", company: "Carta", tags: ["fintech", "finance", "accounting"] },
  { source: "greenhouse", slug: "gusto", company: "Gusto", tags: ["fintech", "accounting", "tech"] },
  { source: "greenhouse", slug: "justworks", company: "Justworks", tags: ["fintech", "accounting"] },
  { source: "greenhouse", slug: "mercury", company: "Mercury", tags: ["fintech", "banking"] },
  { source: "greenhouse", slug: "betterment", company: "Betterment", tags: ["fintech", "finance"] },
  { source: "greenhouse", slug: "taxbit", company: "TaxBit", tags: ["fintech", "accounting", "tax"] },
  { source: "ashby", slug: "ramp", company: "Ramp", tags: ["fintech", "finance", "accounting"] },
  { source: "ashby", slug: "rillet", company: "Rillet", tags: ["fintech", "accounting"] },
  { source: "ashby", slug: "numeric", company: "Numeric", tags: ["fintech", "accounting"] },
  { source: "ashby", slug: "campfire", company: "Campfire", tags: ["fintech", "accounting"] },
  { source: "ashby", slug: "tabs", company: "Tabs", tags: ["fintech", "accounting"] },
  { source: "ashby", slug: "column", company: "Column", tags: ["fintech", "banking"] },
  { source: "ashby", slug: "moderntreasury", company: "Modern Treasury", tags: ["fintech", "finance"] },
  { source: "ashby", slug: "maximor", company: "Maximor", tags: ["fintech", "accounting"] },
  { source: "lever", slug: "crypto", company: "Crypto.com", tags: ["fintech", "finance"] },
  { source: "lever", slug: "anchorage", company: "Anchorage Digital", tags: ["fintech", "finance"] },
  { source: "lever", slug: "binance", company: "Binance", tags: ["fintech", "finance"] },
  { source: "lever", slug: "dnb", company: "Dun & Bradstreet", tags: ["finance", "data"] },

  // Trading firms (internship-heavy)
  { source: "greenhouse", slug: "point72", company: "Point72", tags: ["trading", "finance"] },
  { source: "greenhouse", slug: "janestreet", company: "Jane Street", tags: ["trading", "finance"] },
  { source: "greenhouse", slug: "imc", company: "IMC Trading", tags: ["trading", "finance"] },
  { source: "greenhouse", slug: "drweng", company: "DRW", tags: ["trading", "finance"] },
  { source: "greenhouse", slug: "jumptrading", company: "Jump Trading", tags: ["trading", "finance"] },
  { source: "greenhouse", slug: "akunacapital", company: "Akuna Capital", tags: ["trading", "finance"] },
  { source: "greenhouse", slug: "virtu", company: "Virtu Financial", tags: ["trading", "finance"] },

  // Tech (finance, accounting, data, and engineering internships)
  { source: "greenhouse", slug: "databricks", company: "Databricks", tags: ["tech", "data", "finance"] },
  { source: "greenhouse", slug: "anthropic", company: "Anthropic", tags: ["tech", "finance"] },
  { source: "greenhouse", slug: "datadog", company: "Datadog", tags: ["tech", "finance", "accounting"] },
  { source: "greenhouse", slug: "mongodb", company: "MongoDB", tags: ["tech", "finance", "accounting"] },
  { source: "greenhouse", slug: "cloudflare", company: "Cloudflare", tags: ["tech", "finance", "accounting"] },
  { source: "greenhouse", slug: "elastic", company: "Elastic", tags: ["tech", "finance"] },
  { source: "greenhouse", slug: "okta", company: "Okta", tags: ["tech", "finance"] },
  { source: "greenhouse", slug: "samsara", company: "Samsara", tags: ["tech", "finance"] },
  { source: "greenhouse", slug: "verkada", company: "Verkada", tags: ["tech", "finance"] },
  { source: "greenhouse", slug: "figma", company: "Figma", tags: ["tech", "finance"] },
  { source: "greenhouse", slug: "twilio", company: "Twilio", tags: ["tech", "finance"] },
  { source: "greenhouse", slug: "vercel", company: "Vercel", tags: ["tech", "finance"] },
  { source: "greenhouse", slug: "asana", company: "Asana", tags: ["tech"] },
  { source: "greenhouse", slug: "airbnb", company: "Airbnb", tags: ["tech", "consumer"] },
  { source: "greenhouse", slug: "lyft", company: "Lyft", tags: ["tech", "consumer"] },
  { source: "greenhouse", slug: "instacart", company: "Instacart", tags: ["tech", "consumer"] },
  { source: "greenhouse", slug: "pinterest", company: "Pinterest", tags: ["tech", "consumer"] },
  { source: "greenhouse", slug: "reddit", company: "Reddit", tags: ["tech", "consumer"] },
  { source: "greenhouse", slug: "roblox", company: "Roblox", tags: ["tech"] },
  { source: "greenhouse", slug: "epicgames", company: "Epic Games", tags: ["tech"] },
  { source: "greenhouse", slug: "duolingo", company: "Duolingo", tags: ["tech", "consumer"] },
  { source: "greenhouse", slug: "dropbox", company: "Dropbox", tags: ["tech"] },
  { source: "greenhouse", slug: "discord", company: "Discord", tags: ["tech"] },
  { source: "greenhouse", slug: "scaleai", company: "Scale AI", tags: ["tech", "data"] },
  { source: "greenhouse", slug: "spacex", company: "SpaceX", tags: ["tech", "engineering", "finance"] },
  { source: "greenhouse", slug: "waymo", company: "Waymo", tags: ["tech", "engineering"] },
  { source: "greenhouse", slug: "nuro", company: "Nuro", tags: ["tech", "engineering"] },
  { source: "greenhouse", slug: "flexport", company: "Flexport", tags: ["tech", "finance", "accounting", "operations"] },
  { source: "greenhouse", slug: "squarespace", company: "Squarespace", tags: ["tech"] },
  { source: "greenhouse", slug: "webflow", company: "Webflow", tags: ["tech"] },
  { source: "greenhouse", slug: "peloton", company: "Peloton", tags: ["consumer"] },
  { source: "greenhouse", slug: "sweetgreen", company: "Sweetgreen", tags: ["consumer"] },
  { source: "greenhouse", slug: "glossier", company: "Glossier", tags: ["consumer", "marketing"] },
  { source: "ashby", slug: "openai", company: "OpenAI", tags: ["tech", "finance", "accounting"] },
  { source: "ashby", slug: "notion", company: "Notion", tags: ["tech"] },
  { source: "ashby", slug: "linear", company: "Linear", tags: ["tech"] },
  { source: "ashby", slug: "perplexity", company: "Perplexity", tags: ["tech"] },
  { source: "ashby", slug: "harvey", company: "Harvey", tags: ["tech", "legal"] },
  { source: "ashby", slug: "vanta", company: "Vanta", tags: ["tech", "finance"] },
  { source: "ashby", slug: "cursor", company: "Cursor", tags: ["tech"] },
  { source: "ashby", slug: "elevenlabs", company: "ElevenLabs", tags: ["tech", "finance"] },
  { source: "ashby", slug: "sierra", company: "Sierra", tags: ["tech"] },
  { source: "ashby", slug: "decagon", company: "Decagon", tags: ["tech"] },
  { source: "ashby", slug: "replit", company: "Replit", tags: ["tech"] },
  { source: "ashby", slug: "supabase", company: "Supabase", tags: ["tech"] },
  { source: "ashby", slug: "watershed", company: "Watershed", tags: ["tech", "sustainability"] },
  { source: "ashby", slug: "rilla", company: "Rilla", tags: ["tech", "sales"] },
  { source: "ashby", slug: "persona", company: "Persona", tags: ["tech"] },
  { source: "lever", slug: "palantir", company: "Palantir", tags: ["tech", "data"] },
  { source: "lever", slug: "veeva", company: "Veeva Systems", tags: ["tech", "health", "finance"] },
  { source: "lever", slug: "shieldai", company: "Shield AI", tags: ["tech", "engineering"] },
  { source: "lever", slug: "spotify", company: "Spotify", tags: ["tech", "consumer"] },
  { source: "lever", slug: "zoox", company: "Zoox", tags: ["tech", "engineering"] },
  { source: "lever", slug: "hive", company: "Hive", tags: ["tech"] },
  { source: "lever", slug: "ro", company: "Ro", tags: ["health", "tech"] },
  { source: "lever", slug: "rover", company: "Rover", tags: ["consumer", "tech"] },
  { source: "lever", slug: "outreach", company: "Outreach", tags: ["tech", "sales"] },

  // Enterprise on SmartRecruiters
  { source: "smartrecruiters", slug: "LinkedIn3", company: "LinkedIn", tags: ["tech", "finance"] },
  { source: "smartrecruiters", slug: "ServiceNow", company: "ServiceNow", tags: ["tech", "finance"] },
  { source: "smartrecruiters", slug: "Experian", company: "Experian", tags: ["finance", "data"] },
  { source: "smartrecruiters", slug: "WesternDigital", company: "Western Digital", tags: ["tech", "engineering"] },
  { source: "smartrecruiters", slug: "Continental", company: "Continental", tags: ["engineering"] },
  { source: "smartrecruiters", slug: "Colliers", company: "Colliers", tags: ["real estate", "finance"] },
  { source: "smartrecruiters", slug: "Equinox", company: "Equinox", tags: ["consumer"] },
];

/** Big employers on Workday: banks, Big 4, insurers, and North Carolina employers. Searched by keyword. */
export const WORKDAY: Array<Tagged<WorkdayRef>> = [
  { tenant: "pwc", wd: "wd3", site: "US_Entry_Level_Careers", company: "PwC", tags: ["accounting", "consulting", "tax", "finance"] },
  { tenant: "wf", wd: "wd1", site: "WellsFargoJobs", company: "Wells Fargo", tags: ["banking", "finance", "nc"] },
  { tenant: "ghr", wd: "wd1", site: "Lateral-US", company: "Bank of America", tags: ["banking", "finance", "nc"] },
  { tenant: "citi", wd: "wd5", site: "2", company: "Citi", tags: ["banking", "finance"] },
  { tenant: "vanguard", wd: "wd5", site: "vanguard_external", company: "Vanguard", tags: ["finance", "banking"] },
  { tenant: "mastercard", wd: "wd1", site: "CorporateCareers", company: "Mastercard", tags: ["fintech", "finance", "tech"] },
  { tenant: "dukeenergy", wd: "wd1", site: "search", company: "Duke Energy", tags: ["energy", "finance", "accounting", "nc"] },
  { tenant: "redhat", wd: "wd5", site: "jobs", company: "Red Hat", tags: ["tech", "nc"] },
  { tenant: "lowes", wd: "wd5", site: "LWS_External_CS", company: "Lowe's", tags: ["consumer", "finance", "nc"] },
  { tenant: "labcorp", wd: "wd1", site: "External", company: "Labcorp", tags: ["health", "finance", "nc"] },
  { tenant: "iqvia", wd: "wd1", site: "IQVIA", company: "IQVIA", tags: ["health", "data", "nc"] },
  { tenant: "humana", wd: "wd5", site: "Humana_External_Career_Site", company: "Humana", tags: ["health", "finance"] },
  { tenant: "salesforce", wd: "wd12", site: "External_Career_Site", company: "Salesforce", tags: ["tech", "finance"] },
  { tenant: "nvidia", wd: "wd5", site: "NVIDIAExternalCareerSite", company: "NVIDIA", tags: ["tech", "engineering"] },
];

const ROLE_TAGS: Record<string, string[]> = {
  accounting: ["accounting", "fintech", "finance"],
  audit: ["accounting", "consulting"],
  tax: ["accounting", "tax", "fintech"],
  finance: ["finance", "fintech", "banking"],
  banking: ["banking", "finance", "trading"],
  consulting: ["consulting", "accounting"],
  data: ["data", "tech", "finance"],
  software: ["tech", "engineering"],
};

/** Workday sites worth querying for these roles (every query costs a round trip per site). */
export function workdayFor(roles: string[], locations: string[]): Array<Tagged<WorkdayRef>> {
  const tags = new Set(roles.flatMap((r) => ROLE_TAGS[r] ?? [r]));
  const nc = locations.some((l) => /\b(nc|north carolina|raleigh|durham|charlotte|cary|greensboro|chapel hill)\b/i.test(l));
  const hits = WORKDAY.filter((w) => w.tags.some((t) => tags.has(t)) || (nc && w.tags.includes("nc")));
  return hits.length ? hits : WORKDAY;
}

/** Company boards that match the role families; full set when there is no role signal. */
export function boardsFor(roles: string[]): Array<Tagged<BoardRef>> {
  if (!roles.length) return BOARDS;
  const tags = new Set(roles.flatMap((r) => ROLE_TAGS[r] ?? [r]));
  const hits = BOARDS.filter((b) => b.tags.some((t) => tags.has(t)));
  return hits.length ? hits : BOARDS;
}
