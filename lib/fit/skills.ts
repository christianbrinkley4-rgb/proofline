/**
 * Skills taxonomy: one canonical name per skill, with the ways postings and
 * students actually write it. Matching is on canonical names, so "VLOOKUP" in a
 * posting counts toward Excel, and "A/P" toward accounts payable.
 */

type SkillDef = { name: string; patterns: RegExp[]; category: "accounting" | "finance" | "data" | "software" | "business" | "tool" | "soft" | "language" | "credential" };

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The canonical name matches literally ("C++", "Node.js"); the alternates are regex patterns. */
const s = (name: string, category: SkillDef["category"], ...alts: string[]): SkillDef => ({
  name,
  category,
  patterns: [literal(name), ...alts].map((p) => new RegExp(`(?<![a-z0-9])${p}(?![a-z0-9])`, "i")),
});

export const SKILLS: SkillDef[] = [
  // Accounting
  s("GAAP", "accounting", "us gaap", "generally accepted accounting principles"),
  s("IFRS", "accounting"),
  s("Account reconciliation", "accounting", "reconcil(e|es|ed|ing|iation|iations)", "bank rec(s|onciliations?)?"),
  s("Journal entries", "accounting", "journal entr(y|ies)", "jes?"),
  s("General ledger", "accounting", "general ledger", "gl"),
  s("Accounts payable", "accounting", "accounts payable", "a/p", "ap processing", "vendor payments?", "paying vendors"),
  s("Accounts receivable", "accounting", "accounts receivable", "a/r", "collections", "invoicing", "billing"),
  s("Month-end close", "accounting", "month[- ]end( close)?", "financial close", "close process", "quarter[- ]end"),
  s("Financial statements", "accounting", "financial statements?", "balance sheets?", "income statements?", "cash flow statements?", "p&l"),
  s("Financial reporting", "accounting", "financial reporting", "sec reporting", "10-k", "10-q"),
  s("Auditing", "accounting", "audit(ing|s)?", "assurance", "substantive testing", "workpapers", "audit procedures"),
  s("Internal controls", "accounting", "internal controls?", "sox", "sarbanes[- ]oxley", "control testing"),
  s("Tax preparation", "accounting", "tax (preparation|returns?|prep)", "prepar(e|ed|ing) (\\d+ )?(federal|state|individual|corporate)? ?(tax )?returns?", "form 1040", "1040s?", "vita"),
  s("Partnership and corporate tax", "accounting", "1065", "1120s?", "k-1s?", "partnership returns?", "corporate tax"),
  s("Revenue recognition", "accounting", "revenue recognition", "asc 606", "rev ?rec"),
  s("Payroll", "accounting", "payroll"),
  s("Bookkeeping", "accounting", "bookkeeping", "did the books", "books"),
  s("Cost accounting", "accounting", "cost accounting", "inventory costing", "standard costs?"),
  s("Fixed assets", "accounting", "fixed assets?", "depreciation"),
  // Finance
  s("Financial modeling", "finance", "financial model(s|ing|ling)?", "three[- ]statement model", "lbo", "dcf", "discounted cash flow"),
  s("Valuation", "finance", "valuations?", "comparable companies", "comps", "precedent transactions"),
  s("Budgeting and forecasting", "finance", "budget(s|ing)?", "forecast(s|ing)?", "fp&a", "planning and analysis"),
  s("Variance analysis", "finance", "variance analysis", "budget vs\\.? actuals?", "bva"),
  s("Treasury", "finance", "treasury", "cash management", "cash flow forecasting"),
  s("Investment research", "finance", "investment research", "equity research", "due diligence", "pitch books?"),
  s("Capital markets", "finance", "capital markets", "fixed income", "equities", "derivatives"),
  // Data and analytics
  s("SQL", "data", "sql", "postgres(ql)?", "mysql", "t-sql"),
  s("Python", "software", "python", "pandas", "numpy"),
  s("R", "data", "r programming", "rstudio", "r(?= and python| or python)"),
  s("Tableau", "data", "tableau"),
  s("Power BI", "data", "power ?bi"),
  s("Alteryx", "data", "alteryx"),
  s("Data analysis", "data", "data analysis", "analy[sz](e|ed|ing) data", "data analytics", "analytics"),
  s("Statistics", "data", "statistic(s|al)", "regression", "hypothesis testing"),
  s("Machine learning", "data", "machine learning", "ml models?", "deep learning"),
  // Software
  s("JavaScript", "software", "javascript", "js"),
  s("TypeScript", "software", "typescript"),
  s("React", "software", "react(\\.js)?"),
  s("Node.js", "software", "node(\\.js)?"),
  s("Java", "software", "java(?!script)"),
  s("C++", "software", "c\\+\\+"),
  s("Go", "software", "golang"),
  s("AWS", "software", "aws", "amazon web services"),
  s("Git", "software", "git(hub)?"),
  // Tools
  s("Excel", "tool", "excel", "spreadsheets?", "pivot tables?", "v ?lookups?", "x ?lookups?", "index[- ]match", "google sheets"),
  s("QuickBooks", "tool", "quickbooks( online)?", "qbo"),
  s("NetSuite", "tool", "netsuite"),
  s("SAP", "tool", "sap"),
  s("Oracle", "tool", "oracle"),
  s("Workday", "tool", "workday"),
  s("Salesforce", "tool", "salesforce", "sfdc"),
  s("HubSpot", "tool", "hubspot"),
  s("PowerPoint", "tool", "powerpoint", "google slides", "keynote"),
  s("Bloomberg", "tool", "bloomberg( terminal)?"),
  s("Capital IQ", "tool", "capital iq", "capiq"),
  s("FactSet", "tool", "factset"),
  s("Tax software", "tool", "taxslayer", "lacerte", "ultratax", "cch axcess", "prosystem", "turbotax"),
  s("Jira", "tool", "jira"),
  s("Figma", "tool", "figma"),
  s("Google Analytics", "tool", "google analytics", "ga4"),
  // Service, operations, healthcare, and trades
  s("Point-of-sale systems", "tool", "point[ -]of[ -]sale", "pos systems?", "pos terminal", "cash registers?"),
  s("Electronic health records", "tool", "electronic health records?", "ehr", "emr"),
  s("Cash handling", "business", "cash handl(ing|ed)", "balanc(ed|ing) (a |the )?cash drawer"),
  s("Inventory management", "business", "inventory management", "inventory control", "cycle count(s|ing)?", "stock(ed|ing) shelves"),
  s("Appointment scheduling", "business", "appointment schedul(e|ing|ed)", "schedul(ed|ing) appointments?"),
  s("Patient care", "business", "patient care", "patient intake", "assisted patients?"),
  s("Vital signs", "business", "vital signs?", "blood pressure readings?"),
  s("Forklift operation", "business", "forklifts?", "lift trucks?"),
  s("Blueprint reading", "business", "blueprints?", "read(ing)? construction plans?"),
  s("Electrical wiring", "business", "electrical wiring", "install(ed|ing)? (electrical )?wiring"),
  // Business and soft skills
  s("Project management", "business", "project management", "managed projects?", "project manager"),
  s("Customer service", "business", "customer service", "client service", "customer[- ]facing", "client[- ]facing", "front desk", "guest services"),
  s("Communication", "soft", "communication", "written and verbal", "presentation skills"),
  s("Teamwork", "soft", "teamwork", "collaborat(e|ion|ive)", "team player", "cross[- ]functional"),
  s("Leadership", "soft", "leadership", "led (a|the|\\d)", "team lead", "president", "captain", "vice president"),
  s("Attention to detail", "soft", "attention to detail", "detail[- ]oriented", "accuracy", "accurate"),
  s("Problem solving", "soft", "problem[- ]solving", "analytical"),
  s("Marketing", "business", "marketing", "social media", "content creation", "seo", "campaigns?"),
  s("Sales", "business", "sales", "business development", "prospecting"),
  // Languages
  s("Spanish", "language", "spanish", "bilingual"),
  s("Mandarin", "language", "mandarin", "chinese"),
  s("French", "language", "french"),
  // Credentials
  s("CPA", "credential", "cpa", "certified public accountant"),
  s("CFA", "credential", "cfa", "chartered financial analyst"),
  s("CMA", "credential", "cma", "certified management accountant"),
  s("Enrolled Agent", "credential", "enrolled agent"),
  s("SIE", "credential", "sie exam", "securities industry essentials"),
];

export function extractSkills(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const skill of SKILLS) {
    if (skill.patterns.some((p) => p.test(text))) found.push(skill.name);
  }
  return found;
}

export function skillCategory(name: string): SkillDef["category"] | null {
  return SKILLS.find((sk) => sk.name === name)?.category ?? null;
}

/**
 * Skills that count toward coverage. Soft skills are real but nobody should lose points for not
 * writing "teamwork" on a resume, and credentials are handled as eligibility gates instead
 * ("150 hours for CPA eligibility" in an intern posting isn't a CPA requirement).
 */
export function isHardSkill(name: string): boolean {
  const category = skillCategory(name);
  return category !== "soft" && category !== "credential";
}
