import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { ensureProfile, updateProfile } from "@/lib/kb/profile";
import { logEvent } from "./events";
import { isKnownDealBreaker } from "./learn";

/**
 * Standing rules are the profile's dealbreakers (see dealBreakerMatches in learn.ts),
 * which the Find jobs feed, search, and the assisted loop all honor. A correction on
 * the Ready page ("not this employer", "not titles with this word") is written here,
 * so it holds from then on instead of being asked again.
 */

export const MAX_RULES = 40;

export type Rule = { raw: string; kind: "company" | "title" | "other"; label: string };

const COMPANY = "company:";

/** The text stored for an employer, matched exactly (ignoring case) against a posting's company. */
export const companyRule = (company: string) => `${COMPANY}${company.trim().toLowerCase()}`;

/** A title word, kept to plain letters, digits, and spaces so it matches as a whole word. */
export function titleWordRule(input: string): string | null {
  const word = input.trim().toLowerCase().replace(/\s+/g, " ");
  return /^[a-z0-9][a-z0-9 -]{1,38}[a-z0-9]$/.test(word) ? word : null;
}

const titleCase = (text: string) => text.replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function describeRule(raw: string): Rule {
  const text = raw.trim();
  if (text.toLowerCase().startsWith(COMPANY)) return { raw, kind: "company", label: `Jobs at ${titleCase(text.slice(COMPANY.length).trim())}` };
  // Onboarding choices ("unpaid", "commission only") are read from the posting; anything else is a title word.
  if (isKnownDealBreaker(text)) return { raw, kind: "other", label: `Postings that say "${text}"` };
  return { raw, kind: "title", label: `Titles with "${text}"` };
}

export async function listRules(userId: string): Promise<Rule[]> {
  const profile = await ensureProfile(userId);
  return profile.dealBreakers.map(describeRule);
}

export async function addRule(userId: string, raw: string, why: { jobId?: string } = {}): Promise<{ added: boolean }> {
  const profile = await ensureProfile(userId);
  const key = raw.trim().toLowerCase();
  if (!key || profile.dealBreakers.some((b) => b.trim().toLowerCase() === key)) return { added: false };
  if (profile.dealBreakers.length >= MAX_RULES) throw new Error("That's the most standing rules Proofline will keep. Remove one first.");
  await updateProfile(userId, { dealBreakers: [...profile.dealBreakers, key] });
  await logEvent(userId, "rule_added", { rule: key, via: "correction", ...why });
  return { added: true };
}

export async function removeRule(userId: string, raw: string): Promise<void> {
  const profile = await db.query.profile.findFirst({ where: eq(schema.profile.userId, userId) });
  if (!profile) return;
  const next = profile.dealBreakers.filter((b) => b !== raw);
  if (next.length === profile.dealBreakers.length) return;
  await updateProfile(userId, { dealBreakers: next });
  await logEvent(userId, "rule_removed", { rule: raw });
}
