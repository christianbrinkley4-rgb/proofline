/**
 * Role families: what a person types, and the title words that count as a match.
 * "accounting" should find "Audit Intern" and "Staff Accountant", not only titles
 * that literally say "accounting".
 */
export const ROLE_FAMILIES: Array<{ id: string; label: string; triggers: string[]; titleWords: string[]; museCategory?: string; excludeTitle?: RegExp }> = [
  {
    id: "accounting",
    label: "Accounting",
    triggers: ["accounting", "accountant", "accountancy", "bookkeeping", "cpa"],
    titleWords: ["accounting", "accountant", "audit", "auditor", "assurance", "tax", "bookkeep", "controller", "accounts payable", "accounts receivable", "revenue accounting", "general ledger", "reconciliation", "payroll"],
    museCategory: "Accounting and Finance",
    excludeTitle: /quality assurance|\bqa\b|software|engineer|revenue operations|sales/i,
  },
  { id: "audit", label: "Audit", triggers: ["audit", "auditing", "assurance"], titleWords: ["audit", "auditor", "assurance", "internal controls", "sox"], museCategory: "Accounting and Finance", excludeTitle: /quality assurance|\bqa\b|software|engineer/i },
  { id: "tax", label: "Tax", triggers: ["tax", "taxation"], titleWords: ["tax"], museCategory: "Accounting and Finance" },
  {
    id: "finance",
    label: "Finance",
    triggers: ["finance", "financial", "fp&a", "fpa", "treasury", "corporate finance"],
    titleWords: ["finance", "financial", "fp&a", "treasury", "strategic finance", "corporate finance", "financial analyst", "budget"],
    museCategory: "Accounting and Finance",
  },
  {
    id: "banking",
    label: "Banking and investing",
    triggers: ["investment banking", "banking", "ib", "private equity", "wealth management", "asset management", "trading", "markets", "equity research"],
    titleWords: ["investment banking", "banking", "capital markets", "private equity", "wealth", "asset management", "trading", "trader", "equity research", "markets", "investment"],
  },
  {
    id: "consulting",
    label: "Consulting",
    triggers: ["consulting", "consultant", "advisory", "strategy"],
    titleWords: ["consult", "advisory", "strategy", "deals", "transaction"],
  },
  {
    id: "business",
    label: "Business and operations",
    triggers: ["business", "business administration", "business management", "operations", "business analyst", "bizops", "strategy and operations", "management trainee", "rotational program", "leadership development"],
    // Bare "business" matters: "Business Intern" and "Business Development Associate" are the
    // most common titles a student searching "business" expects to see.
    titleWords: [
      "business",
      "business development",
      "business analyst",
      "operations",
      "bizops",
      "strategy & operations",
      "strategy and operations",
      "corporate development",
      "management trainee",
      "management associate",
      "rotational",
      "leadership development",
      "general management",
      "program",
    ],
    museCategory: "Business Operations",
    excludeTitle: /software|engineer|developer|\bdevops\b/i,
  },
  {
    id: "data",
    label: "Data and analytics",
    triggers: ["data", "analytics", "data analyst", "data science", "business intelligence", "bi"],
    titleWords: ["data", "analytics", "analyst", "business intelligence", "insights", "machine learning"],
    museCategory: "Data and Analytics",
  },
  {
    id: "software",
    label: "Software engineering",
    triggers: ["software", "software engineering", "swe", "developer", "engineering", "programming", "web development"],
    titleWords: ["software", "engineer", "developer", "swe", "backend", "frontend", "full stack", "full-stack", "mobile"],
    museCategory: "Software Engineering",
  },
  {
    id: "marketing",
    label: "Marketing",
    triggers: ["marketing", "social media", "brand", "growth", "content"],
    titleWords: ["marketing", "brand", "growth", "content", "social media", "communications"],
    museCategory: "Advertising and Marketing",
  },
  { id: "sales", label: "Sales", triggers: ["sales", "business development", "bdr", "sdr"], titleWords: ["sales", "account executive", "business development", "sdr", "bdr"], museCategory: "Sales" },
  { id: "product", label: "Product", triggers: ["product management", "product manager", "pm", "product"], titleWords: ["product manager", "product management", "associate product"], museCategory: "Product Management" },
  { id: "hr", label: "People and HR", triggers: ["hr", "human resources", "people", "recruiting"], titleWords: ["human resources", "hr", "people", "recruit", "talent"] },
  { id: "customer-service", label: "Customer Service", triggers: ["customer-service", "customer service", "call center", "customer support"], titleWords: ["customer service", "customer support", "call center", "client service"], museCategory: "Customer Service" },
  { id: "administration", label: "Administration", triggers: ["administration", "administrative", "admin assistant", "office assistant", "receptionist"], titleWords: ["administrative", "office assistant", "receptionist", "office coordinator"], museCategory: "Administration and Office" },
  { id: "hospitality", label: "Hospitality and food service", triggers: ["restaurant", "hospitality", "food service", "hotel", "guest services", "catering"], titleWords: ["restaurant", "hospitality", "food service", "hotel", "guest services", "catering", "general manager"], museCategory: "Food and Beverage" },
  { id: "retail", label: "Retail", triggers: ["retail", "store associate", "cashier", "merchandising"], titleWords: ["retail", "store associate", "cashier", "merchandis", "sales associate"], museCategory: "Retail" },
  { id: "healthcare", label: "Healthcare", triggers: ["medical assistant", "patient care", "healthcare", "nursing assistant"], titleWords: ["medical assistant", "patient care", "healthcare", "nursing assistant", "care coordinator"], museCategory: "Healthcare" },
  { id: "warehouse", label: "Warehouse", triggers: ["warehouse", "inventory associate", "fulfillment", "logistics"], titleWords: ["warehouse", "inventory", "fulfillment", "logistics", "distribution"], museCategory: "Manufacturing and Warehouse" },
  { id: "trades", label: "Trades", triggers: ["trades", "electrician", "plumber", "welder", "skilled trades", "apprentice"], titleWords: ["electrician", "plumber", "welder", "apprentice", "technician"], museCategory: "Construction" },
  { id: "project", label: "Project Management", triggers: ["project", "project coordinator", "project manager", "project management"], titleWords: ["project coordinator", "project manager", "project management"], museCategory: "Project Management" },
];

export function familiesFor(words: string[]) {
  const text = ` ${words.map(correctRoleWord).join(" ").toLowerCase()} `;
  return ROLE_FAMILIES.filter((f) => f.triggers.some((t) => text.includes(` ${t} `) || text.includes(` ${t}s `)));
}

/**
 * Misspellings people actually type into a job search. Checked before the fuzzy
 * fallback so the common ones never depend on edit distance.
 */
const TYPOS: Record<string, string> = {
  buisness: "business",
  busness: "business",
  bussiness: "business",
  bussines: "business",
  busines: "business",
  buissness: "business",
  businesss: "business",
  bizness: "business",
  acounting: "accounting",
  accouting: "accounting",
  accounitng: "accounting",
  acountant: "accountant",
  finanace: "finance",
  finace: "finance",
  finnance: "finance",
  marketting: "marketing",
  markting: "marketing",
  analyist: "analyst",
  anaylst: "analyst",
  analitics: "analytics",
  consluting: "consulting",
  consultng: "consulting",
  opperations: "operations",
  operatons: "operations",
  managment: "management",
  mangement: "management",
  softwear: "software",
  enginering: "engineering",
  recuiting: "recruiting",
  healtcare: "healthcare",
  warehous: "warehouse",
};

/** Single-word triggers, the vocabulary a typo can be corrected toward. */
const TRIGGER_WORDS = [...new Set(ROLE_FAMILIES.flatMap((f) => f.triggers).filter((t) => !t.includes(" ") && t.length >= 6))];

/**
 * Fix a likely misspelling of a role word ("buisness" to "business"). Only swaps,
 * one extra letter, or one missing letter count, never a changed letter, so real
 * words like "produce" are left alone instead of becoming "product".
 */
export function correctRoleWord(word: string): string {
  const w = word.toLowerCase();
  if (TYPOS[w]) return TYPOS[w];
  if (w.length < 6 || TRIGGER_WORDS.includes(w)) return word;
  const hit = TRIGGER_WORDS.find((t) => nearMiss(w, t) || nearMiss(w, `${t}s`));
  return hit ?? word;
}

function nearMiss(a: string, b: string): boolean {
  if (a === b) return false;
  if (a.length === b.length) {
    const diff = [...a].flatMap((c, i) => (c === b[i] ? [] : [i]));
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  if (long.length - short.length !== 1) return false;
  for (let i = 0; i < long.length; i++) {
    if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  }
  return false;
}

/** Words from a query that were read as a different role word, for "Showing results for ..." notes. */
export function roleCorrections(words: string[]): Array<{ from: string; to: string }> {
  return words.flatMap((w) => {
    const to = correctRoleWord(w);
    return to.toLowerCase() !== w.toLowerCase() ? [{ from: w, to }] : [];
  });
}

/** Families a thin search could widen into, closest first. Used to suggest the next query. */
export const RELATED_FAMILIES: Record<string, string[]> = {
  business: ["sales", "project", "consulting", "marketing", "data"],
  accounting: ["audit", "tax", "finance"],
  audit: ["accounting", "consulting"],
  tax: ["accounting", "audit"],
  finance: ["accounting", "banking", "business"],
  banking: ["finance", "consulting"],
  consulting: ["business", "finance", "project"],
  data: ["business", "software", "finance"],
  software: ["data", "product"],
  marketing: ["sales", "business", "product"],
  sales: ["business", "marketing", "customer-service"],
  product: ["project", "business", "marketing"],
  hr: ["administration", "business"],
  "customer-service": ["sales", "retail", "administration"],
  administration: ["customer-service", "hr", "project"],
  retail: ["customer-service", "sales", "warehouse"],
  healthcare: ["administration", "customer-service"],
  warehouse: ["retail", "trades"],
  trades: ["warehouse"],
  project: ["business", "product", "administration"],
};

/** True when a title matches a role family's words but is really something else ("Quality Assurance Engineer"). */
export function titleExcluded(title: string, roles: string[]): boolean {
  const families = ROLE_FAMILIES.filter((f) => roles.includes(f.id) && f.excludeTitle);
  return families.length > 0 && families.every((f) => f.excludeTitle!.test(title));
}

/** Title words to match for a set of role terms. Unknown terms match as themselves. */
export function titleWordsFor(roles: string[]): string[] {
  const families = familiesFor(roles);
  const words = new Set(families.flatMap((f) => f.titleWords));
  for (const r of roles) {
    if (!families.some((f) => f.triggers.includes(r))) words.add(r);
  }
  return [...words];
}

/** Keep Workday's two-page budget while giving distinct requested roles a query each. */
export function workdayQueriesFor(roles: string[], level: "internship" | "entry" | "any"): string[] {
  const families = familiesFor(roles);
  const terms = families.length ? families.map((family) => family.label) : roles;
  const queries = [...new Set(terms.map((term) => term.replace(/ and .*/, "").trim()).filter(Boolean))].slice(0, 2);
  if (!queries.length) return [level === "internship" ? "intern" : ""];
  return queries.map((term) => level === "internship" ? `${term} intern` : term);
}
