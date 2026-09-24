import { ROLE_FAMILIES, familiesFor } from "./roles";

export type RoleDiscoveryInput = {
  targetRoles: string[];
  confirmedFacts: Array<{ content: string; category: string; experienceId?: string | null }>;
  experiences: Array<{ id: string; title: string | null }>;
};

export type RoleRecommendation = {
  id: string;
  label: string;
  query: string;
  source: "goal" | "profile";
  reason: string;
};

// These are transferable signals, not job requirements. A title match alone is never
// treated as proof that someone qualifies for a job in the family.
const SIGNALS: Record<string, RegExp> = {
  accounting: /\b(bookkeep(?:ing|er)?|account(?:s|ing)? payable|account(?:s|ing)? receivable|reconcil(?:e|iation)|quickbooks|payroll|general ledger|audit)\b/i,
  finance: /\b(financial analysis|budget(?:ing)?|forecast(?:ing)?|financial model(?:ing)?|treasury)\b/i,
  data: /\b(data analys(?:is|t)|sql|power bi|tableau|dashboard(?:s)?|data visuali[sz]ation)\b/i,
  software: /\b(programm(?:ing|er)|software develop(?:ment|er)|javascript|typescript|python|web develop(?:ment|er)|git)\b/i,
  marketing: /\b(marketing|social media|campaign(?:s)?|content creat(?:ion|or)|email marketing|seo)\b/i,
  sales: /\b(sales|business development|prospect(?:ing)?|lead generation|crm|account executive)\b/i,
  business: /\b(operations|process improvement|business analys(?:is|t)|vendor management|workflow)\b/i,
  "customer-service": /\b(customer service|customer support|client service|helped customers|handled customer|call center|resolved customer)\b/i,
  administration: /\b(administrat(?:ion|ive)|office assistant|reception(?:ist)?|schedul(?:e|ed|ing)|calendar management|data entry|filing)\b/i,
  retail: /\b(retail|cashier|point of sale|merchandis(?:ing|e)|store associate|stock(?:ing|ed) shelves)\b/i,
  healthcare: /\b(patient care|medical assistant|nursing assistant|clinical|electronic health record|medical record)\b/i,
  warehouse: /\b(warehouse|fulfill(?:ment|ed)|inventory|forklift|shipping|receiving|logistics)\b/i,
  trades: /\b(electrician|electrical work|plumb(?:er|ing)|weld(?:er|ing)|carpentry|hvac|apprentice)\b/i,
  project: /\b(project coordinat(?:or|ion)|project manage(?:r|ment)|event planning|coordinated (?:a |the )?(?:team|project|event))\b/i,
};

const UNSPECIFIC_GOAL = /^(any(?:thing)?|open to anything|not sure|unsure|don't know|dont know|jobs?|roles?)$/i;
const EVIDENCE_CATEGORIES = new Set(["experience", "metric", "skill", "tool", "education", "certification", "award", "leadership", "project"]);

/** A short list of paths to explore, based only on stated goals and confirmed evidence. */
export function recommendRoles(input: RoleDiscoveryInput, limit = 3): RoleRecommendation[] {
  if (limit <= 0) return [];
  const out: RoleRecommendation[] = [];
  const used = new Set<string>();

  for (const statedRole of input.targetRoles) {
    const role = statedRole.trim();
    if (!role || UNSPECIFIC_GOAL.test(role)) continue;
    const family = familiesFor(role.toLowerCase().split(/\s+/))[0];
    const id = family?.id ?? `goal:${role.toLowerCase()}`;
    if (used.has(id)) continue;
    used.add(id);
    out.push({ id, label: family?.label ?? role, query: role, source: "goal", reason: `You listed ${role} as a goal.` });
    if (out.length >= Math.min(limit, 2)) break;
  }

  const confirmedEvidence = input.confirmedFacts.filter((f) => EVIDENCE_CATEGORIES.has(f.category));
  const confirmedExperienceIds = new Set(confirmedEvidence.map((f) => f.experienceId).filter(Boolean));
  const evidence = [
    ...confirmedEvidence.map((f) => f.content),
    ...input.experiences.filter((e) => confirmedExperienceIds.has(e.id)).map((e) => e.title).filter((t): t is string => Boolean(t)),
  ];
  const inferred = ROLE_FAMILIES.flatMap((family) => {
    if (used.has(family.id)) return [];
    const rule = SIGNALS[family.id];
    if (!rule) return [];
    const matches = [...new Set(evidence.map((text) => text.match(rule)?.[0].trim()).filter((x): x is string => Boolean(x)))];
    if (!matches.length) return [];
    return [{ family, matches }];
  }).sort((a, b) => b.matches.length - a.matches.length || ROLE_FAMILIES.indexOf(a.family) - ROLE_FAMILIES.indexOf(b.family));

  for (const { family, matches } of inferred) {
    if (out.length >= limit) break;
    const labels = matches.slice(0, 2);
    out.push({
      id: family.id,
      label: family.label,
      query: `${family.label} jobs`,
      source: "profile",
      reason: `Your confirmed profile mentions ${labels.join(" and ")}.`,
    });
  }
  return out;
}
