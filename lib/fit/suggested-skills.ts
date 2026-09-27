type ExperienceClue = { title: string | null; org: string };

/** Examples to ask about, never claims added to a profile until the person selects them. */
export function suggestedSkillsFor(experiences: ExperienceClue[]): string[] {
  const context = experiences.map(({ title, org }) => [title, org].filter(Boolean).join(" ")).join(" ").toLowerCase();
  if (/clinical data|data manager|clinical trial/.test(context)) {
    return ["Medidata Rave", "CDISC", "SDTM", "CDASH", "SQL", "Data analysis", "People management", "Excel"];
  }
  if (/restaurant|bistro|hotel|hospitality|food|retail|cashier|store|server|front desk/.test(context)) {
    return ["Customer service", "Point-of-sale systems", "Cash handling", "Inventory management", "People management", "Excel", "Spanish"];
  }
  if (/clinic|hospital|medical|patient|nurs|health/.test(context)) {
    return ["Electronic health records", "Appointment scheduling", "Patient intake", "Insurance verification", "Patient care", "Spanish", "Excel"];
  }
  if (/account|bookkeep|tax|audit|finance/.test(context)) {
    return ["Excel", "QuickBooks", "Account reconciliation", "Journal entries", "Accounts payable", "Payroll", "Power BI"];
  }
  if (/software|developer|engineer|data analy|programmer/.test(context)) {
    return ["SQL", "Python", "JavaScript", "TypeScript", "React", "Git", "Excel"];
  }
  if (/construction|electric|warehouse|delivery|driver|logistic/.test(context)) {
    return ["Inventory management", "Blueprint reading", "Forklift operation", "Customer service", "Excel"];
  }
  return ["Excel", "Google Sheets", "Customer service", "Project management", "Spanish", "PowerPoint"];
}
