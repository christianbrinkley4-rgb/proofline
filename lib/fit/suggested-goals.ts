type ExperienceClue = { title: string | null; org: string };

export type GoalSuggestions = {
  roles: string[];
  industries: string[];
  dealBreakers: string[];
};

/** Optional examples based on work history. They never become a goal until selected. */
export function suggestedGoalsFor(experiences: ExperienceClue[]): GoalSuggestions {
  const context = experiences.map(({ title, org }) => [title, org].filter(Boolean).join(" ")).join(" ").toLowerCase();
  const commonDealBreakers = ["Unpaid", "Commission only", "Weekend shifts", "Relocation"];

  if (/clinical data|data manager|clinical trial/.test(context)) {
    return {
      roles: ["Clinical data manager", "Senior clinical data manager", "Clinical data lead", "Clinical operations manager", "Data quality manager", "Biostatistics analyst"],
      industries: ["Clinical research", "Biotechnology", "Pharmaceuticals", "Healthcare"],
      dealBreakers: commonDealBreakers,
    };
  }
  if (/restaurant|bistro|hotel|hospitality|food service|cafe|café/.test(context)) {
    return {
      roles: ["Restaurant general manager", "Food service manager", "Hotel operations manager", "Guest services manager", "Restaurant operations manager", "Catering manager"],
      industries: ["Hospitality", "Restaurants", "Food service", "Travel"],
      dealBreakers: commonDealBreakers,
    };
  }
  if (/clinic|hospital|medical|patient|nurs|health/.test(context)) {
    return {
      roles: ["Medical assistant", "Patient care coordinator", "Clinic administrator", "Healthcare operations coordinator", "Patient services representative"],
      industries: ["Healthcare", "Hospitals", "Outpatient care", "Public health"],
      dealBreakers: commonDealBreakers,
    };
  }
  if (/account|bookkeep|tax|audit|finance/.test(context)) {
    return {
      roles: ["Staff accountant", "Bookkeeper", "Accounts payable specialist", "Financial analyst", "Accounting manager", "Tax associate"],
      industries: ["Accounting", "Financial services", "Government", "Healthcare"],
      dealBreakers: [...commonDealBreakers, "Requires a CPA already"],
    };
  }
  if (/software|developer|engineer|data analy|programmer/.test(context)) {
    return {
      roles: ["Software engineer", "Data analyst", "Quality assurance engineer", "Technical support specialist", "Business analyst", "Product analyst"],
      industries: ["Technology", "Healthcare", "Financial services", "Government"],
      dealBreakers: commonDealBreakers,
    };
  }
  if (/retail|cashier|store|sales associate/.test(context)) {
    return {
      roles: ["Retail associate", "Store supervisor", "Assistant store manager", "Customer service representative", "Inventory specialist"],
      industries: ["Retail", "Consumer goods", "Hospitality", "Logistics"],
      dealBreakers: commonDealBreakers,
    };
  }
  if (/construction|electric|warehouse|delivery|driver|logistic/.test(context)) {
    return {
      roles: ["Warehouse associate", "Logistics coordinator", "Delivery driver", "Electrician apprentice", "Operations supervisor"],
      industries: ["Logistics", "Construction", "Transportation", "Manufacturing"],
      dealBreakers: commonDealBreakers,
    };
  }
  return {
    roles: ["Customer service representative", "Administrative assistant", "Project coordinator", "Retail associate", "Data analyst", "Medical assistant", "Warehouse associate", "Accounting assistant"],
    industries: ["Healthcare", "Technology", "Government", "Nonprofit", "Retail", "Hospitality", "Manufacturing"],
    dealBreakers: commonDealBreakers,
  };
}
