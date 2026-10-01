import { evidenceFor, type CandidateIndex, type CandidateProfile, type FitReport } from "@/lib/fit/engine";
import type { Knockout } from "@/lib/fit/knockouts";
import { ROLE_FAMILIES } from "../roles";

/**
 * How the feed orders and explains listings. The fit score is never changed here:
 * knockouts sort last, and what the person saved or dismissed only moves a listing
 * up or down the list, with a note saying so.
 */

export type FeedSignal = { title: string; company: string; status: "saved" | "dismissed" };

/** The role families a title belongs to ("Staff Auditor" is accounting and audit). */
function familiesOfTitle(title: string): string[] {
  const t = title.toLowerCase();
  return ROLE_FAMILIES.filter((f) => f.titleWords.some((w) => t.includes(w)) && !(f.excludeTitle?.test(title) ?? false)).map((f) => f.id);
}

const companyKey = (company: string) => company.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Preference = { points: number; note: string | null };

const PREFERENCE_CAP = 8;

/**
 * Saves pull similar listings up; dismissals push them down. "Similar" means the same
 * kind of role or the same employer. Capped so a single save can't bury a stronger fit.
 */
export function preferenceModel(signals: FeedSignal[]): (job: { title: string; company: string }) => Preference {
  const families = new Map<string, { saved: number; dismissed: number }>();
  const companies = new Map<string, { saved: number; dismissed: number }>();
  const bump = (map: Map<string, { saved: number; dismissed: number }>, key: string, status: FeedSignal["status"]) => {
    const entry = map.get(key) ?? { saved: 0, dismissed: 0 };
    entry[status]++;
    map.set(key, entry);
  };
  for (const signal of signals) {
    for (const family of familiesOfTitle(signal.title)) bump(families, family, signal.status);
    bump(companies, companyKey(signal.company), signal.status);
  }
  if (!signals.length) return () => ({ points: 0, note: null });

  return (job) => {
    let role = 0;
    for (const family of familiesOfTitle(job.title)) {
      const entry = families.get(family);
      if (entry) role += 2 * entry.saved - 2 * entry.dismissed;
    }
    const employer = companies.get(companyKey(job.company));
    const company = employer ? 2 * employer.saved - 3 * employer.dismissed : 0;
    const points = Math.max(-PREFERENCE_CAP, Math.min(PREFERENCE_CAP, Math.max(-6, Math.min(6, role)) + company));
    const note =
      points >= 2
        ? company > 0 && role <= 0
          ? `Moved up: you saved a job at ${job.company}`
          : "Moved up: like jobs you saved"
        : points <= -2
          ? company < 0 && role >= 0
            ? `Moved down: you dismissed a job at ${job.company}`
            : "Moved down: like jobs you dismissed"
          : null;
    return { points, note };
  };
}

/** Shortens at a word boundary so a quoted fact never ends mid-word. */
function clip(text: string, max = 80): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 3);
  return `${(cut.lastIndexOf(" ") > max / 2 ? cut.slice(0, cut.lastIndexOf(" ")) : cut).replace(/[\s,;:.]+$/, "")}...`;
}

const listOf = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0] ?? "");

/** One plain line on why this listing scored the way it did, citing the person's own fact when there is one. */
export function feedReason(fit: FitReport, candidate: CandidateProfile, index: CandidateIndex): string {
  const matched = fit.details.requiredSkills.matched;
  const missing = fit.details.requiredSkills.missing;
  if (matched.length) {
    const top = matched.slice(0, 2);
    const evidence = evidenceFor(matched[0], candidate, index);
    const gap = missing.length ? ` Not in your experience yet: ${missing[0]}.` : "";
    return `Wants ${listOf(top)}; your experience shows ${top.length > 1 ? "both" : "it"}${evidence ? `, as in "${clip(evidence)}"` : ""}.${gap}`;
  }
  const role = fit.details.experience.matched[0];
  if (role) return `Your ${role} experience is the same kind of work.${missing.length ? ` Not in your experience yet: ${listOf(missing.slice(0, 2))}.` : ""}`;
  if (missing.length) return `Wants ${listOf(missing.slice(0, 2))}, which your experience doesn't show yet.`;
  const field = fit.details.education.matched[0];
  if (field) return `No specific skills listed; your ${field} studies match what they ask for.`;
  return "No specific skills listed, so the score rests on your background, studies, and location.";
}

export type FeedChip = { kind: "knockout" | "unknown" | "match"; text: string };

/** Up to two chips: knockouts first (they decide whether to apply at all), then matches. */
export function feedChips(knockouts: Knockout[], fit: FitReport): FeedChip[] {
  const chips: FeedChip[] = knockouts.filter((k) => k.status === "knockout").map((k) => ({ kind: "knockout", text: k.label }));
  const matches = [
    ...fit.details.requiredSkills.matched,
    ...fit.details.experience.matched.map((t) => `${t} experience`),
    ...fit.details.education.matched.filter((m) => !m.startsWith("GPA")),
    ...fit.details.preferredSkills.matched,
  ];
  for (const text of matches) chips.push({ kind: "match", text });
  // "Couldn't check" only fills a slot nothing better took.
  for (const k of knockouts.filter((k) => k.status === "unknown")) chips.push({ kind: "unknown", text: `${k.label}: add yours` });
  return chips.slice(0, 2);
}

export type Rankable = { score: number; knockout: boolean; preference: number; postedAt: Date | null };

/** Knockouts last; then fit score plus preference; then newest. */
export function compareFeed(a: Rankable, b: Rankable): number {
  return (
    Number(a.knockout) - Number(b.knockout) ||
    b.score + b.preference - (a.score + a.preference) ||
    (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0)
  );
}
