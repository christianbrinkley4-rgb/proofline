import type { Profile } from "@/lib/kb/profile";

/**
 * What the agent learns from how the student reacts to jobs. It never changes a
 * preference on its own: each pattern becomes a suggestion the student accepts
 * or waves off, and a waved-off suggestion isn't asked again.
 */

export type Dismissal = {
  reason: string | null;
  company: string | null;
  title: string | null;
  mode: string | null;
  location: string | null;
  payMax: number | null;
  payPeriod: string | null;
};

export type PreferencePatch = Partial<Pick<Profile, "workModes" | "payFloor" | "dealBreakers">>;

export type Suggestion = {
  /** Stable key, so an answer is remembered: "mode:no-onsite", "company:walmart", "title:sales". */
  key: string;
  question: string;
  because: string;
  patch: PreferencePatch;
};

const MIN_PATTERN = 3;

/** Title words that describe a kind of work, for "Wrong kind of role" patterns. */
const ROLE_WORDS = ["sales", "marketing", "audit", "tax", "engineering", "software", "operations", "recruiting", "customer", "support", "retail", "insurance", "actuarial", "underwriting", "banking", "trading", "research", "design", "data", "hr"];

export function suggestPreferences(dismissals: Dismissal[], profile: Pick<Profile, "workModes" | "payFloor" | "dealBreakers" | "targetRoles">, answered: Set<string>): Suggestion[] {
  const out: Suggestion[] = [];
  const add = (s: Suggestion) => {
    if (!answered.has(s.key) && !out.some((o) => o.key === s.key)) out.push(s);
  };

  // Setup: most dismissals are on-site roles, and the profile still allows on-site.
  const onsite = dismissals.filter((d) => d.mode === "onsite");
  const allowsOnsite = !profile.workModes.length || profile.workModes.includes("onsite");
  if (allowsOnsite && onsite.length >= MIN_PATTERN && onsite.length / Math.max(dismissals.length, 1) >= 0.6) {
    add({
      key: "mode:no-onsite",
      question: "Only show remote and hybrid roles?",
      because: `You've passed on ${onsite.length} on-site roles.`,
      patch: { workModes: ["remote", "hybrid"] },
    });
  }

  // Pay: roles dismissed as underpaid, all hourly and all below some amount.
  const underpaid = dismissals.filter((d) => d.reason === "Pay too low" && d.payMax != null && d.payPeriod === "hour");
  if (underpaid.length >= 2) {
    const ceiling = Math.max(...underpaid.map((d) => d.payMax!));
    const floor = Math.ceil(ceiling + 1);
    if (!profile.payFloor || profile.payFloor < floor) {
      add({
        key: `pay:${floor}`,
        question: `Hide roles that top out under $${floor}/hr?`,
        because: `You've passed on ${underpaid.length} roles for low pay, all at $${ceiling}/hr or less.`,
        patch: { payFloor: floor },
      });
    }
  }

  // Companies the student said they're not interested in.
  const companies = new Map<string, { name: string; count: number }>();
  for (const d of dismissals) {
    if (d.reason !== "Not interested in this company" || !d.company) continue;
    const key = d.company.toLowerCase();
    companies.set(key, { name: d.company, count: (companies.get(key)?.count ?? 0) + 1 });
  }
  for (const [key, { name, count }] of companies) {
    if (profile.dealBreakers.some((b) => b.toLowerCase() === `company:${key}`)) continue;
    add({
      key: `company:${key}`,
      question: `Stop showing jobs at ${name}?`,
      because: count > 1 ? `You've said no to ${name} ${count} times.` : `You said you're not interested in ${name}.`,
      patch: { dealBreakers: [...profile.dealBreakers, `company:${name}`] },
    });
  }

  // A kind of role the student keeps calling wrong, that isn't one of their targets.
  const wrong = dismissals.filter((d) => d.reason === "Wrong kind of role" && d.title);
  const targets = profile.targetRoles.join(" ").toLowerCase();
  for (const word of ROLE_WORDS) {
    const hits = wrong.filter((d) => new RegExp(`\\b${word}\\b`, "i").test(d.title!));
    if (hits.length < 2 || targets.includes(word) || profile.dealBreakers.some((b) => b.toLowerCase() === word)) continue;
    add({
      key: `title:${word}`,
      question: `Skip roles with "${word}" in the title?`,
      because: `You've marked ${hits.length} ${word} roles as the wrong kind of role.`,
      patch: { dealBreakers: [...profile.dealBreakers, word] },
    });
  }

  return out.slice(0, 3);
}

/** The deal-breakers onboarding offers, and what each one looks like in a posting. */
const KNOWN: Array<{ match: RegExp; posting: RegExp }> = [
  { match: /^unpaid$/, posting: /\bunpaid\b|\bno (pay|compensation)\b|\bvolunteer (position|role)\b/i },
  { match: /^commission[- ]only$/, posting: /\bcommission[- ]only\b|\b100% commission\b|\bstraight commission\b/i },
  { match: /^requires a cpa( already)?$|^cpa required$/, posting: /\b(active|current|valid) cpa (license|licence)\b|\bcpa (license|licence|certification) (is )?required\b|\bmust (be|hold) (a )?(licensed )?cpa\b/i },
  { match: /^weekend shifts?$/, posting: /\bweekend (shifts?|availability) (is )?required\b|\bmust (be able to )?work weekends\b/i },
  { match: /^relocation$/, posting: /\b(must|required to|willing(ness)? to) relocate\b|\brelocation (is )?required\b/i },
];

/**
 * Deal-breakers as search exclusions. "company:Walmart" matches the employer; the
 * onboarding choices match what postings actually say; anything else matches the title.
 * The description is checked once it's known.
 */
export function dealBreakerMatches(dealBreakers: string[], job: { company: string; title: string; department?: string | null; description?: string | null }): boolean {
  const title = `${job.title} ${job.department ?? ""}`;
  const text = `${title}\n${job.description ?? ""}`;
  return dealBreakers.some((raw) => {
    const b = raw.trim().toLowerCase();
    if (!b) return false;
    if (b.startsWith("company:")) return job.company.toLowerCase() === b.slice(8).trim();
    const known = KNOWN.find((k) => k.match.test(b));
    if (known) return known.posting.test(text);
    return new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(title);
  });
}
