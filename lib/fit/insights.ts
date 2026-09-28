import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { normalizePhrase } from "@/lib/jobs/keywords";
import type { FitReport } from "./engine";
import { inSentence } from "./gaps";
import type { Requirements } from "./requirements";
import { extractSkills, skillCategory } from "./skills";

/**
 * The notes under the score: what this role rewards, and one pattern across
 * every role the person saved. Rules only; no model.
 */

function mentions(text: string, term: string): number {
  const escaped = term.split(/\s+or\s+/i)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`(?<![a-z0-9])${escaped}`, "gi")) ?? []).length;
}

/** Two plain bullets: the requirements this posting leans on hardest. */
export function roleRewards(description: string | null, req: Requirements, keywords: string[]): string[] {
  const text = description ?? "";
  const required = [...new Set(req.requiredGroups.map((g) => g.join(" or ")))]
    .map((skill) => ({ skill, count: Math.max(1, mentions(text, skill)) }))
    .sort((a, b) => b.count - a.count);
  const out: string[] = [];
  const [first, second] = required;
  if (first && second) {
    out.push(`Hands-on ${inSentence(first.skill)} and ${inSentence(second.skill)}. They lead the requirements${first.count > 1 ? `, and ${inSentence(first.skill)} comes up ${first.count} times` : ""}.`);
  } else if (first) {
    out.push(`Hands-on ${inSentence(first.skill)}. It's the one skill the requirements name outright.`);
  }
  if (req.yearsExperience) {
    out.push(`About ${req.yearsExperience}+ years of related work. Dated experience on your resume matters here.`);
  } else {
    // A duty phrase the first bullet didn't already name.
    const named = new Set(required.slice(0, 2).flatMap((r) => r.skill.split(/\s+or\s+/i)).map(normalizePhrase));
    const duty = keywords.find((k) => k.includes(" ") && !named.has(k) && !extractSkills(k).some((s) => named.has(normalizePhrase(s))));
    if (duty) out.push(`Day-to-day ${duty} work. The posting leans on that phrase, so a bullet that names it reads as a direct match.`);
  }
  if (out.length < 2 && req.minGpa) out.push(`Academics: they set a ${req.minGpa} GPA minimum.`);
  if (out.length < 2) out.push("Clear, measured results. With few named requirements, bullets with numbers carry the most weight.");
  return out.slice(0, 2);
}

function fastestFix(skill: string): string {
  const category = skillCategory(skill.split(/\s+or\s+/i)[0]);
  if (category === "tool" || category === "software" || category === "data") {
    return `a free tutorial plus one small project you can describe in a bullet. If you've already used ${skill.split(/\s+or\s+/i)[0]} somewhere, answer its question on one of these jobs instead`;
  }
  if (category === "credential") return `the credential itself. Check how long it takes; some take a weekend, others a semester`;
  if (category === "language") return "only claim it if you can hold a conversation. A placement test gives you an honest level to state";
  return `one real example. If you've done it at work, school, or a club, answer its question on one of these jobs and every saved role rescores`;
}

export type CrossInsight = { text: string; skill: string | null; count: number; saved: number };

/** Across the person's saved roles: the requirement they keep missing, and the quickest honest fix. */
export async function crossPostingInsight(userId: string): Promise<CrossInsight> {
  const matches = await db.query.jobMatch.findMany({
    where: and(eq(schema.jobMatch.userId, userId), ne(schema.jobMatch.status, "dismissed")),
    columns: { jobId: true, fit: true },
  });
  const saved = matches.length;
  if (saved < 2) {
    return { text: "Save a few more roles and a pattern shows up here: the skill employers keep asking for, and the fastest honest way to add it.", skill: null, count: 0, saved };
  }
  const counts = new Map<string, number>();
  for (const match of matches) {
    const fit = match.fit as unknown as Pick<FitReport, "details"> | null;
    for (const skill of new Set(fit?.details?.requiredSkills?.missing ?? [])) counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!top || top[1] < 2) {
    return { text: `Across your ${saved} saved roles, no single required skill keeps coming up missing. Your facts cover the common asks; the fastest gains now are numbers in your bullets.`, skill: null, count: 0, saved };
  }
  const [skill, count] = top;
  return {
    text: `Across your ${saved} saved roles, employers keep asking for ${skill} (${count} of ${saved}). The fastest fix is ${fastestFix(skill)}.`,
    skill,
    count,
    saved,
  };
}

/** Job ids this person has saved, for pages that list them. */
export async function savedJobIds(userId: string): Promise<string[]> {
  const rows = await db.query.jobMatch.findMany({ where: and(eq(schema.jobMatch.userId, userId), inArray(schema.jobMatch.status, ["saved", "new"])), columns: { jobId: true } });
  return rows.map((r) => r.jobId);
}
