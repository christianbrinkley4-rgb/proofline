import type { FactBase, FactRow, RoleBlock } from "@/lib/facts/base";
import { dedupeSkills, hasNumber, skillName } from "@/lib/resume/polish";
import { nearDuplicate } from "@/lib/resume/suggest";
import { isActionVerb } from "@/lib/resume/verbs";

/**
 * LinkedIn profile text built only from confirmed facts, for the person to paste
 * in themselves. Nothing is posted. The one thing only they can say, what they
 * want next, stays a bracketed prompt, the same rule the cover letter follows.
 */

/** LinkedIn's field limits, so the page can show how much room is left. */
export const LINKEDIN_LIMITS = { headline: 220, about: 2600, description: 2000 } as const;

export const ABOUT_PROMPT = "[What you want to do next, in one or two sentences of your own.]";

export type LinkedInRole = { id: string; title: string; org: string; dates: string; location: string; description: string; bullets: number };

export type LinkedInKit = {
  headline: string;
  about: string;
  roles: LinkedInRole[];
  skills: string[];
  licenses: string[];
  /** How many confirmed facts the kit draws on. */
  factCount: number;
};

export type KitProfile = { targetRoles?: string[] | null; gradDate?: string | null };

const field = (rows: FactRow[], name: string) => rows.find((r) => r.field === name)?.text.trim() ?? "";

/** "Recorded 40 entries" becomes "recorded 40 entries"; "QuickBooks" and "SQL" stay as written. */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

/** "NC State VITA Program" reads as "the NC State VITA Program"; "Acme Health" stays as it is. */
const TAKES_THE = /\b(program|department|office|center|centre|committee|council|society|association|lab|laboratory|team|institute)$/i;
const withArticle = (org: string) => (TAKES_THE.test(org) && !/^the\s/i.test(org) ? `the ${org}` : org);

const sentence = (text: string) => text.trim().replace(/[.;,\s]+$/, "") + ".";

/**
 * One line per piece of work. When two lines describe the same work ("Posted vendor
 * payments" and "Posted 150+ vendor payments a month"), keep the one with a number,
 * or else the longer one, in the first one's place.
 */
function distinctLines(items: string[]): string[] {
  const kept: string[] = [];
  for (const item of unique(items)) {
    const i = kept.findIndex((k) => nearDuplicate(k, item));
    if (i === -1) kept.push(item);
    else if ((hasNumber(item) && !hasNumber(kept[i])) || (hasNumber(item) === hasNumber(kept[i]) && item.length > kept[i].length)) kept[i] = item;
  }
  return kept;
}

/** Jobs and internships tell the story first, then volunteering; clubs and projects follow. */
const STORY_RANK: Record<string, number> = { work: 0, internship: 0, volunteer: 1, research: 2, leadership: 3, project: 4 };

/** Most recent first, the order LinkedIn and recruiters read: current roles, then by end and start month. */
function byRecency(a: RoleBlock, b: RoleBlock): number {
  const end = (r: RoleBlock) => r.experience.endDate ?? (r.experience.startDate ? "9999-99" : "");
  return end(b).localeCompare(end(a)) || (b.experience.startDate ?? "").localeCompare(a.experience.startDate ?? "");
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.map((i) => i.trim()).filter((i) => i && !seen.has(i.toLowerCase()) && seen.add(i.toLowerCase()));
}

/** Still in school when the graduation month is this month or later. */
function studying(gradDate: string | null | undefined, today: Date): boolean {
  const match = gradDate?.match(/^(\d{4})-(\d{2})/);
  if (!match) return false;
  const month = Number(match[1]) * 12 + Number(match[2]) - 1;
  return month >= today.getFullYear() * 12 + today.getMonth();
}

/** Joins headline parts with " | ", dropping trailing parts until it fits LinkedIn's limit. */
function fitHeadline(parts: string[]): string {
  const kept = parts.filter(Boolean);
  while (kept.length > 1 && kept.join(" | ").length > LINKEDIN_LIMITS.headline) kept.pop();
  return kept.join(" | ").slice(0, LINKEDIN_LIMITS.headline);
}

export function buildLinkedInKit(base: FactBase, profile: KitProfile = {}, today = new Date()): LinkedInKit {
  const school = field(base.education, "school");
  const major = field(base.education, "major") || field(base.education, "degree");
  const gradText = field(base.education, "grad_date");
  const inSchool = Boolean(school) && studying(profile.gradDate, today);
  const skills = dedupeSkills(unique(base.skill.map((s) => s.text)), skillName);
  // The headline has no room for "(pivot tables, XLOOKUP)"; the Skills section keeps it.
  const skillHeads = unique(skills.map((s) => s.replace(/\s*\(.*\)\s*$/, "")));
  const licenses = unique(base.license.map((l) => l.text));

  const recent = [...base.roles].sort(byRecency);
  const roles: LinkedInRole[] = recent
    .filter((r) => r.bullets.length || field(r.header, "title"))
    .map((r) => {
      const bullets = distinctLines(r.bullets.map((b) => b.text));
      return {
        id: r.experience.id,
        title: field(r.header, "title"),
        org: field(r.header, "org") || r.experience.org,
        dates: field(r.header, "dates"),
        location: field(r.header, "location"),
        description: bullets.map((b) => `• ${sentence(b)}`).join("\n").slice(0, LINKEDIN_LIMITS.description),
        bullets: bullets.length,
      };
    });

  const latest = roles.find((r) => r.title && r.org);
  const identity = inSchool && school ? `${major ? `${major} student` : "Student"} at ${school}` : latest ? `${latest.title} at ${latest.org}` : school ? `${major || "Graduate"}, ${school}` : "";
  const wants = unique(profile.targetRoles ?? []).slice(0, 2);
  const headline = fitHeadline([identity, wants.length ? `Open to: ${wants.join(", ")}` : "", skillHeads.slice(0, 3).join(", ")]);

  const about: string[] = [];
  if (school) {
    const subject = major ? `${major} at ${school}` : `at ${school}`;
    about.push(inSchool ? `I'm studying ${subject}${gradText ? `, graduating ${gradText}` : ""}.` : `I studied ${subject}.`);
  }
  // "At Acme, I reconciled..." only reads right when the line opens with a past-tense action verb.
  const opensWithVerb = (text: string) => {
    const first = text.trim().split(/\s+/)[0] ?? "";
    return isActionVerb(first) || /^[A-Z][a-z]+ed$/.test(first);
  };
  const rank = (r: RoleBlock) => STORY_RANK[r.experience.kind] ?? 5;
  const stories = [...recent]
    .sort((a, b) => rank(a) - rank(b))
    .map((r) => {
      const lines = distinctLines(r.bullets.map((b) => b.text)).filter(opensWithVerb);
      return { org: field(r.header, "org") || r.experience.org, line: lines.find(hasNumber) ?? lines[0] };
    })
    .filter((s): s is { org: string; line: string } => Boolean(s.org && s.line))
    .slice(0, 2);
  for (const story of stories) about.push(`At ${withArticle(story.org)}, I ${lowerFirst(sentence(story.line))}`);
  if (skills.length) about.push(`Tools and skills I've used: ${skills.slice(0, 8).join(", ")}.`);
  if (licenses.length) about.push(`${licenses.length === 1 ? "License or certification" : "Licenses and certifications"}: ${licenses.join(", ")}.`);
  about.push(ABOUT_PROMPT);

  const factCount = base.education.length + base.skill.length + base.license.length + base.roles.reduce((n, r) => n + r.header.length + r.bullets.length, 0);
  return { headline, about: about.join("\n\n").slice(0, LINKEDIN_LIMITS.about), roles, skills, licenses, factCount };
}
