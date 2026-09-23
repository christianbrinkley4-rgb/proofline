/**
 * Role families: what a student types, and the title words that count as a match.
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
    triggers: ["business", "operations", "business analyst", "bizops", "strategy and operations"],
    titleWords: ["business analyst", "operations", "business operations", "bizops", "strategy & operations", "program"],
    museCategory: "Business Operations",
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
];

export function familiesFor(words: string[]) {
  const text = ` ${words.join(" ").toLowerCase()} `;
  return ROLE_FAMILIES.filter((f) => f.triggers.some((t) => text.includes(` ${t} `) || text.includes(` ${t}s `)));
}

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
