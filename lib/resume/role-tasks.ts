import { ROLE_FAMILIES } from "@/lib/jobs/roles";
import { skillCategory } from "@/lib/fit/skills";

export type RoleTask = {
  id: string;
  families: string[];
  titleWords: string[];
  template: string;
  skills: string[];
  slot?: string;
  related: string[];
  /** O*NET core classification, not an individual probability. */
  common?: boolean;
};

const task = (
  id: string, families: string[], titleWords: string[], template: string,
  skills: string[], related: string[] = [], slot?: string,
): RoleTask => ({ id, families, titleWords, template, skills, related, slot });

/** These are questions about common work, never claims about this person. */
export const ROLE_TASKS: RoleTask[] = [
  task("books.reconcile", ["accounting"], ["bookkeep", "account", "finance"], "Reconciled [how many?] account balances each month", ["Bookkeeping", "Account reconciliation"], ["books.payables"], "how many?"),
  task("books.payables", ["accounting"], ["bookkeep", "account"], "Processed vendor invoices and tracked payments", ["Accounts payable", "Bookkeeping"], ["books.reconcile"]),
  task("books.records", ["accounting"], ["bookkeep", "account"], "Maintained transaction records for month-end review", ["Bookkeeping", "Financial reporting"], ["books.reconcile"]),
  task("front.schedule", ["administration", "healthcare"], ["front desk", "reception", "office", "dental"], "Scheduled appointments and updated the office calendar", ["Appointment scheduling", "Customer service"], ["front.intake"]),
  task("front.intake", ["administration", "healthcare"], ["front desk", "reception", "office", "dental"], "Welcomed visitors and checked intake information", ["Customer service", "Attention to detail"], ["front.schedule"]),
  task("front.questions", ["administration"], ["front desk", "reception", "office"], "Answered calls and routed questions to the right staff", ["Communication", "Customer service"], ["front.intake"]),
  task("retail.checkout", ["retail"], ["retail", "cashier", "store", "sales associate"], "Processed customer purchases using the point-of-sale system", ["Point-of-sale systems", "Customer service"], ["retail.drawer"]),
  task("retail.drawer", ["retail"], ["retail", "cashier", "store"], "Balanced the cash drawer at the end of each shift", ["Cash handling", "Attention to detail"], ["retail.checkout"]),
  task("retail.stock", ["retail"], ["retail", "store", "sales associate"], "Counted inventory and restocked shelves", ["Inventory management"], ["retail.checkout"]),
  task("food.orders", [], ["server", "barista", "restaurant", "food", "cafe", "kitchen"], "Prepared customer orders and checked them for accuracy", ["Customer service", "Attention to detail"], ["food.service"]),
  task("food.service", [], ["server", "barista", "restaurant", "food", "cafe"], "Resolved customer requests during busy service periods", ["Customer service", "Problem solving"], ["food.orders"]),
  task("food.open", [], ["server", "barista", "restaurant", "food", "cafe", "kitchen"], "Completed opening and closing checks for the shift", ["Attention to detail"], ["food.orders"]),
  task("teach.lesson", [], ["tutor", "teacher", "teaching assistant", "ta"], "Prepared lesson materials for [how many?] students", ["Communication"], ["teach.feedback"], "how many?"),
  task("teach.feedback", [], ["tutor", "teacher", "teaching assistant", "ta"], "Explained difficult concepts and gave students specific feedback", ["Communication", "Problem solving"], ["teach.lesson"]),
  task("teach.progress", [], ["tutor", "teacher", "teaching assistant", "ta"], "Tracked student progress and adjusted practice activities", ["Data analysis", "Communication"], ["teach.feedback"]),
  task("support.tickets", ["customer-service"], ["customer service", "support", "call center"], "Resolved customer questions through the support queue", ["Customer service", "Problem solving"], ["support.escalate"]),
  task("support.escalate", ["customer-service"], ["customer service", "support", "call center"], "Documented recurring issues and escalated complex cases", ["Communication", "Attention to detail"], ["support.tickets"]),
  task("support.calls", ["customer-service"], ["customer service", "support", "call center"], "Answered [how many?] customer calls per shift", ["Customer service", "Communication"], ["support.tickets"], "how many?"),
  task("warehouse.pick", ["warehouse"], ["warehouse", "fulfillment", "logistics"], "Picked and packed orders against shipment records", ["Inventory management", "Attention to detail"], ["warehouse.count"]),
  task("warehouse.count", ["warehouse"], ["warehouse", "inventory", "logistics"], "Counted inventory and flagged stock discrepancies", ["Inventory management", "Attention to detail"], ["warehouse.pick"]),
  task("warehouse.ship", ["warehouse"], ["warehouse", "fulfillment", "logistics"], "Prepared outbound shipments and checked labels", ["Inventory management"], ["warehouse.pick"]),
  task("club.budget", [], ["treasurer", "club", "officer", "president", "student organization"], "Prepared the club budget and recorded spending", ["Budgeting and forecasting", "Leadership"], ["club.event"]),
  task("club.event", [], ["club", "officer", "president", "student organization"], "Coordinated club events with members and campus staff", ["Leadership", "Project management"], ["club.budget"]),
  task("club.members", [], ["club", "officer", "president", "student organization"], "Recruited new members and organized onboarding", ["Leadership", "Communication"], ["club.event"]),
  task("research.data", ["data"], ["research assistant", "researcher", "lab assistant"], "Collected and cleaned research data for analysis", ["Data analysis", "Attention to detail"], ["research.lit"]),
  task("research.lit", [], ["research assistant", "researcher", "lab assistant"], "Reviewed research literature and summarized findings", ["Communication", "Data analysis"], ["research.data"]),
  task("research.methods", [], ["research assistant", "researcher", "lab assistant"], "Documented research methods and checked source records", ["Attention to detail"], ["research.data"]),
  task("marketing.content", ["marketing"], ["marketing", "social media", "content"], "Created posts for the organization's social channels", ["Marketing"], ["marketing.measure"]),
  task("marketing.measure", ["marketing"], ["marketing", "social media", "content"], "Measured campaign engagement and summarized the results", ["Marketing", "Data analysis"], ["marketing.content"]),
  task("marketing.calendar", ["marketing"], ["marketing", "social media", "content"], "Planned the publishing calendar with the team", ["Marketing", "Project management"], ["marketing.content"]),
  task("data.clean", ["data"], ["analyst", "data", "analytics"], "Cleaned source data and checked records for errors", ["Data analysis", "Attention to detail"], ["data.report"]),
  task("data.report", ["data"], ["analyst", "data", "analytics"], "Built reports to explain trends to the team", ["Data analysis", "Communication"], ["data.clean"]),
  task("data.query", ["data"], ["analyst", "data", "analytics"], "Wrote SQL queries to answer business questions", ["SQL", "Data analysis"], ["data.report"]),
  task("software.build", ["software"], ["software", "developer", "programmer", "app", "project"], "Built a working feature from a written requirement", ["Project management"], ["software.test"]),
  task("software.test", ["software"], ["software", "developer", "programmer", "app", "project"], "Wrote tests for the project's main workflows", ["Problem solving"], ["software.build"]),
  task("software.fix", ["software"], ["software", "developer", "programmer", "app", "project"], "Diagnosed defects and shipped fixes", ["Problem solving"], ["software.test"]),
  task("health.records", ["healthcare"], ["medical assistant", "clinic", "patient", "dental"], "Updated patient records after visits", ["Electronic health records", "Attention to detail"], ["health.schedule"]),
  task("health.schedule", ["healthcare"], ["medical assistant", "clinic", "patient", "dental"], "Scheduled patient visits and confirmed appointment details", ["Appointment scheduling", "Patient care"], ["health.records"]),
  task("health.intake", ["healthcare"], ["medical assistant", "clinic", "patient"], "Recorded intake information and flagged missing details", ["Patient care", "Attention to detail"], ["health.records"]),
  task("trade.plan", ["trades"], ["electrician", "plumber", "construction", "apprentice"], "Reviewed plans before starting field work", ["Blueprint reading", "Attention to detail"], ["trade.check"]),
  task("trade.check", ["trades"], ["electrician", "plumber", "construction", "apprentice"], "Checked completed work against project requirements", ["Attention to detail", "Problem solving"], ["trade.plan"]),
  task("sales.leads", ["sales"], ["sales", "business development", "account representative"], "Researched prospective customers before outreach", ["Sales", "Communication"], ["sales.followup"]),
  task("sales.followup", ["sales"], ["sales", "business development", "account representative"], "Tracked customer follow-ups and next steps", ["Sales", "Customer service"], ["sales.leads"]),
  task("sales.demo", ["sales"], ["sales", "business development", "account representative"], "Presented product features around customer needs", ["Sales", "Communication"], ["sales.leads"]),
  task("hr.onboard", ["hr"], ["human resources", "recruiting", "people operations"], "Prepared new hire materials and tracked onboarding steps", ["Project management", "Communication"], ["hr.schedule"]),
  task("hr.schedule", ["hr"], ["human resources", "recruiting", "people operations"], "Scheduled candidate interviews and kept records current", ["Appointment scheduling", "Attention to detail"], ["hr.onboard"]),
  task("finance.variance", ["finance"], ["finance", "financial analyst", "budget"], "Compared actual spending with the budget and explained differences", ["Variance analysis", "Budgeting and forecasting"], ["finance.forecast"]),
  task("finance.forecast", ["finance"], ["finance", "financial analyst", "budget"], "Updated forecasts using recent financial results", ["Budgeting and forecasting", "Data analysis"], ["finance.variance"]),
  task("consult.research", ["consulting"], ["consultant", "consulting", "advisory"], "Researched client questions and summarized options", ["Problem solving", "Communication"], ["consult.present"]),
  task("consult.present", ["consulting"], ["consultant", "consulting", "advisory"], "Presented findings and recommendations to the project team", ["Communication", "Project management"], ["consult.research"]),
  task("product.feedback", ["product"], ["product manager", "product intern"], "Reviewed user feedback and grouped recurring requests", ["Data analysis", "Communication"], ["product.scope"]),
  task("product.scope", ["product"], ["product manager", "product intern"], "Documented feature requirements for the team", ["Project management", "Communication"], ["product.feedback"]),
  task("hotel.guest", [], ["hotel", "hospitality", "concierge", "guest service"], "Resolved guest requests and recorded follow-up needs", ["Customer service", "Problem solving"], ["hotel.booking"]),
  task("hotel.booking", [], ["hotel", "hospitality", "concierge", "guest service"], "Updated bookings and confirmed guest details", ["Customer service", "Attention to detail"], ["hotel.guest"]),
  task("care.schedule", [], ["caregiver", "childcare", "nanny", "home care"], "Coordinated daily activities around individual care needs", ["Patient care", "Communication"], ["care.records"]),
  task("care.records", [], ["caregiver", "childcare", "nanny", "home care"], "Recorded daily observations and shared updates with families", ["Communication", "Attention to detail"], ["care.schedule"]),
  task("design.review", [], ["designer", "graphic design", "creative"], "Reviewed drafts against the project brief", ["Attention to detail", "Communication"], ["design.create"]),
  task("design.create", [], ["designer", "graphic design", "creative"], "Created visual assets for a campaign or project", ["Marketing"], ["design.review"]),
  task("event.coordinate", [], ["event", "community organizer", "volunteer coordinator"], "Coordinated volunteers and checked event readiness", ["Leadership", "Project management"], ["event.followup"]),
  task("event.followup", [], ["event", "community organizer", "volunteer coordinator"], "Collected attendee feedback and summarized improvements", ["Communication", "Data analysis"], ["event.coordinate"]),
];

export function tasksForExperience(experience: { title: string | null; kind: string }): RoleTask[] {
  const title = (experience.title ?? "").toLowerCase();
  const familyIds = new Set(ROLE_FAMILIES.filter((family) => family.titleWords.some((word) => titleTermMatches(title, word))).map((family) => family.id));
  return ROLE_TASKS.filter((item) => item.titleWords.some((word) => titleTermMatches(title, word)) || item.families.some((id) => familyIds.has(id)));
}

/** Match role words at word boundaries. Longer single words can be stems such as "bookkeep". */
export function titleTermMatches(title: string, term: string): boolean {
  const clean = term.toLowerCase().trim();
  if (!clean) return false;
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const suffix = /^[a-z]{4,}$/.test(clean) ? "[a-z]*" : "";
  return new RegExp(`(?:^|[^a-z])${escaped}${suffix}(?=$|[^a-z])`, "i").test(title);
}

export function taskSkillsAreKnown(tasks: RoleTask[] = ROLE_TASKS): boolean {
  return tasks.every((item) => item.skills.every((skill) => skillCategory(skill) !== null));
}
