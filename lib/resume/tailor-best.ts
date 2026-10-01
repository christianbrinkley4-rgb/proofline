import { logEvent } from "@/lib/agent/events";
import { checkKnockouts, firstKnockout, knockoutCandidate } from "@/lib/fit/knockouts";
import { extractSkills, SKILLS } from "@/lib/fit/skills";
import { hasUsableJobDescription, JOB_DESCRIPTION_REQUIRED } from "@/lib/jobs/description";
import { parseIntent } from "@/lib/jobs/intent";
import { matchKeywords, normalizePhrase } from "@/lib/jobs/keywords";
import { keywordsOf, requirementsOf, type JobRow } from "@/lib/jobs/store";
import { ensureFactBase, scoringReady } from "@/lib/facts/base";
import { getProfile } from "@/lib/kb/profile";
import { resumeToText } from "@/lib/review/resume-text";
import type { ResumeDocument, VariantId } from "./document";
import { exportBlocked } from "./quality";
import { screeningReport } from "./screening";
import { saveTailoredResume, tailorResume, type TailorResult } from "./tailor";
import { defaultTemplateFor } from "./templates";

/**
 * One best resume per job. The engine builds its three candidate layouts in
 * memory (experience first, skills first, keyword match), keeps the one that
 * shows the most of what this posting asks for, and saves only that one.
 * Every line still comes from confirmed facts; nothing is invented to match a keyword.
 */

/** The posting's own wording for a skill the person confirmed, when it names the very same thing. */
export function employerWording(item: string, jobDescription: string): string | null {
  const canonical = extractSkills(item);
  if (canonical.length !== 1) return null;
  const def = SKILLS.find((s) => s.name === canonical[0]);
  if (!def) return null;
  // Same words, different case, plural, or hyphenation: use the posting's form.
  const words = item.trim().split(/[\s-]+/).map((w) => `${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:e?s)?`);
  const same = jobDescription.match(new RegExp(`(?<![a-z0-9])${words.join("[\\s-]+")}(?![a-z0-9])`, "i"))?.[0];
  if (same && normalizePhrase(same).replace(/-/g, " ") === normalizePhrase(item).replace(/-/g, " ")) {
    // Their plural or hyphenation, in the person's capitalization, so the list reads as one style.
    const mine = item.trim().split(/[\s-]+/);
    let index = 0;
    const theirs = same.replace(/[^\s-]+/g, (word) => {
      const cased = mine[index++] ?? word;
      if (/^[A-Z0-9/&]+$/.test(word) && word.length > 1) return word;
      // Same word, maybe plural: keep the person's exact capitals ("QuickBooks", not "Quickbooks").
      if (word.toLowerCase().startsWith(cased.toLowerCase())) return cased + word.slice(cased.length).toLowerCase();
      return cased[0] === cased[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase();
    });
    return theirs !== item.trim() ? theirs : null;
  }
  // The posting's acronym for the same skill: keep the full name, add theirs.
  for (const pattern of def.patterns) {
    const found = jobDescription.match(pattern)?.[0]?.trim();
    if (found && /^[A-Z/&]{2,5}$/.test(found) && !item.includes(found)) return `${item} (${found})`;
  }
  return null;
}

function mirrorSkills(doc: ResumeDocument, jobDescription: string): { document: ResumeDocument; changes: string[] } {
  const changes: string[] = [];
  const sections = doc.sections.map((section) => {
    if (section.kind !== "skills") return section;
    return {
      ...section,
      lines: section.lines.map((line) => ({
        ...line,
        items: line.items.map((item) => {
          const wording = employerWording(item, jobDescription);
          if (wording) changes.push(`${wording} (you confirmed "${item}")`);
          return wording ?? item;
        }),
      })),
    };
  });
  return { document: { ...doc, sections }, changes };
}

export type TailorOutcome = { ok: true; resumeId: string; variant: VariantId } | { ok: false; error: string };

export async function tailorBestResume(userId: string, job: JobRow, email: string): Promise<TailorOutcome> {
  if (!hasUsableJobDescription(job.description)) return { ok: false, error: JOB_DESCRIPTION_REQUIRED };
  const [profile, readiness] = await Promise.all([getProfile(userId), scoringReady(userId)]);
  if (!readiness.ready) return { ok: false, error: "Add your school and one experience first. Your resume is made only from those." };
  const requirements = requirementsOf(job);
  const knockout = firstKnockout(checkKnockouts({ title: job.title, location: job.location, mode: job.mode, description: job.description, requirements }, knockoutCandidate(profile)));
  if (knockout) return { ok: false, error: `This job has a dealbreaker for you. ${knockout.reason}` };

  await ensureFactBase(userId);
  const template = defaultTemplateFor(parseIntent(job.title).roles);
  const variants: VariantId[] = ["experience", "skills", "ats"];
  const keywords = keywordsOf(job);
  const candidates: Array<{ variant: VariantId; result: TailorResult; covered: number; keywordHits: number; ok: boolean; bullets: number }> = [];
  for (const variant of variants) {
    const built = await tailorResume(userId, { jobId: job.id, template, variant, email });
    const mirrored = mirrorSkills(built.document, job.description ?? "");
    const result: TailorResult = {
      ...built,
      document: mirrored.document,
      adjustments: mirrored.changes.length ? [...built.adjustments, `Skills use the posting's wording where it names the same thing: ${mirrored.changes.join("; ")}.`] : built.adjustments,
    };
    const report = screeningReport(result.document, requirements);
    candidates.push({
      variant,
      result,
      covered: report.coveredRequired,
      keywordHits: matchKeywords(keywords, resumeToText(result.document)).matched.length,
      ok: !exportBlocked(result.checks),
      bullets: result.why.length,
    });
  }
  const best = [...candidates].sort((a, b) => Number(b.ok) - Number(a.ok) || b.covered - a.covered || b.keywordHits - a.keywordHits || b.bullets - a.bullets)[0];
  if (!best || best.bullets === 0) return { ok: false, error: "Nothing you've confirmed can go on a resume yet. Keep at least one line for one of your roles in My experience." };

  const row = await saveTailoredResume(userId, job.id, best.result, { variant: best.variant, name: `${job.title} at ${job.company}` });
  await logEvent(userId, "tailor_completed", { jobId: job.id, resumeId: row.id, variant: best.variant, covered: best.covered, keywordHits: best.keywordHits });
  return { ok: true, resumeId: row.id, variant: best.variant };
}
