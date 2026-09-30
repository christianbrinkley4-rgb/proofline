import { familiesFor, ROLE_FAMILIES } from "@/lib/jobs/roles";
import { matchKeywords, prepareKeywordText, type KeywordText } from "@/lib/jobs/keywords";
import { isRemoteText, matchesPlace, resolvePlace } from "@/lib/jobs/locations";
import type { JobLevel, JobMode } from "@/lib/jobs/types";
import { formatMonth } from "@/lib/resume/parse/dates";
import type { Requirements } from "./requirements";
import { computeFit, ELIGIBILITY_CAP, type EligibilityGate, type FitComponentKey, type FitPoints, type FitResult } from "./rubric";
import { extractEvidenceSkills, isHardSkill } from "./skills";

/** Scores the evidence in one person's profile against a posting, rules only. */

export type CandidateProfile = {
  /** Every confirmed fact and active bullet, as plain text. */
  confirmedText: string[];
  experienceTitles: string[];
  hasInternship: boolean;
  /** Dated work and internships documented in the profile; overlapping months count once. */
  documentedYearsExperience?: number | null;
  hasUndatedWork?: boolean;
  major: string | null;
  minor: string | null;
  degree: string | null;
  gpa: number | null;
  /** YYYY-MM */
  gradDate: string | null;
  targetLocations: string[];
  workModes: Array<"remote" | "hybrid" | "onsite">;
  needsSponsorship: boolean;
  credentials: string[];
};

export type JobForFit = {
  title: string;
  location: string | null;
  mode: JobMode;
  level: JobLevel;
  requirements: Requirements;
  /** The posting's keyword phrases (lib/jobs/keywords.ts). Without them, skill terms stand in. */
  keywords?: string[] | null;
};

export type ComponentDetail = {
  note: string;
  matched: string[];
  missing: string[];
  /** The arithmetic behind the points, e.g. "30 × 3/4 = 23". */
  math?: string;
  /** One line of reasoning per matched or missing item. */
  why?: Record<string, string>;
};

export type FitReport = FitResult & {
  points: FitPoints;
  details: Record<FitComponentKey, ComponentDetail>;
  gates: EligibilityGate[];
  strengths: string[];
  gaps: string[];
  nextSteps: string[];
  /** Skills inferred from prose rather than explicitly marked required. */
  requirementsInferred?: boolean;
};

/**
 * Everything about the person that doesn't depend on the posting, worked out once.
 * Scoring many postings (a search, the feed) reuses it instead of rereading every fact per posting.
 */
export type CandidateIndex = {
  skills: Set<string>;
  corpus: string;
  keywordText: KeywordText;
  /** Skills each confirmed line shows, in the same order as `confirmedText`. */
  lineSkills: string[][];
};

export function indexCandidate(c: CandidateProfile): CandidateIndex {
  const corpus = [...c.confirmedText, ...c.experienceTitles, c.major ?? "", c.minor ?? "", ...c.credentials].join("\n");
  return {
    skills: new Set(extractEvidenceSkills(corpus)),
    corpus: corpus.toLowerCase(),
    keywordText: prepareKeywordText(corpus.toLowerCase()),
    lineSkills: c.confirmedText.map((text) => extractEvidenceSkills(text)),
  };
}

const round = (n: number) => Math.round(n);

const quote = (text: string) => `"${text.length > 80 ? `${text.slice(0, 77).trimEnd()}...` : text}"`;

/** The first confirmed line that shows a skill, for the one-line reason behind a match. */
export function evidenceFor(label: string, candidate: CandidateProfile, index: CandidateIndex): string | null {
  const parts = label.split(/\s+or\s+/);
  const at = index.lineSkills.findIndex((found) => parts.some((p) => found.includes(p)));
  if (at >= 0) return candidate.confirmedText[at];
  const titles = candidate.experienceTitles.find((t) => parts.some((p) => t.toLowerCase().includes(p.toLowerCase())));
  return titles ?? null;
}

function skillReasons(matched: string[], missing: string[], candidate: CandidateProfile, index: CandidateIndex, kind: "required" | "preferred"): Record<string, string> {
  const why: Record<string, string> = {};
  for (const m of matched) {
    const evidence = evidenceFor(m, candidate, index);
    why[m] = evidence ? `Shown by your fact ${quote(evidence)}.` : "Shown in your confirmed facts.";
  }
  for (const m of missing) why[m] = `The posting lists it as ${kind}; none of your confirmed facts show it yet.`;
  return why;
}

/** Coverage by requirement: a group is met when the person has any skill in it ("Excel or Google Sheets"). */
function coverage(groups: string[][], have: Set<string>) {
  const hard = groups.map((g) => g.filter(isHardSkill)).filter((g) => g.length > 0);
  const label = (g: string[]) => g.join(" or ");
  const matched = hard.filter((g) => g.some((s) => have.has(s))).map((g) => label(g.filter((s) => have.has(s))));
  const missing = hard.filter((g) => !g.some((s) => have.has(s))).map(label);
  return { matched, missing, ratio: hard.length ? matched.length / hard.length : null };
}

function monthsBetween(a: string, b: string): number {
  const [ay, am = "06"] = a.split("-").map(Number) as [number, number?];
  const [by, bm = "06"] = b.split("-").map(Number) as [number, number?];
  return (by - ay) * 12 + (Number(bm) - Number(am));
}

export function scoreFit(job: JobForFit, candidate: CandidateProfile, index = indexCandidate(candidate)): FitReport {
  const req = job.requirements;
  const details = {} as Record<FitComponentKey, ComponentDetail>;
  const points = {} as FitPoints;
  const gates: EligibilityGate[] = [];

  // ── Required skills (30)
  const reqGroups = req.requiredGroups?.length ? req.requiredGroups : req.required.map((sk) => [sk]);
  const reqCov = coverage(reqGroups, index.skills);
  if (reqCov.ratio === null) {
    points.requiredSkills = 20;
    details.requiredSkills = { note: "The posting doesn't list specific skills, so this is a neutral score.", matched: [], missing: [], math: "No listed skills: neutral 20 of 30" };
  } else {
    points.requiredSkills = round(30 * reqCov.ratio);
    const total = reqCov.matched.length + reqCov.missing.length;
    details.requiredSkills = {
      note: `Covers ${reqCov.matched.length} of the ${total} ${req.requiredLines.length ? "listed skill requirements" : "skills mentioned in the posting"}.`,
      matched: reqCov.matched,
      missing: reqCov.missing,
      math: `30 × ${reqCov.matched.length}/${total} = ${points.requiredSkills}`,
      why: skillReasons(reqCov.matched, reqCov.missing, candidate, index, "required"),
    };
  }

  // ── Experience relevance (25): does your background line up with this kind of role, at this level?
  const titleFamilies = ROLE_FAMILIES.filter((f) => f.titleWords.some((w) => job.title.toLowerCase().includes(w)));
  const familyWords = titleFamilies.flatMap((f) => f.titleWords);
  const titleHits = candidate.experienceTitles.filter((t) => familyWords.some((w) => t.toLowerCase().includes(w)));
  const textHits = familyWords.filter((w) => index.corpus.includes(w));
  const relevance = titleHits.length ? 15 : textHits.length >= 2 ? 11 : textHits.length ? 7 : titleFamilies.length ? 3 : 8;
  let seniority = 6;
  let seniorityNote = "";
  const documentedYears = candidate.documentedYearsExperience ?? null;
  const experienceMissing: string[] = [];
  if (job.level === "internship") {
    seniority = 9;
    seniorityNote = "It's an internship, so they expect students and don't need years of experience.";
  } else if (job.level === "entry") {
    seniority = candidate.experienceTitles.length ? 9 : 6;
    seniorityNote = candidate.experienceTitles.length ? "Your recorded experience counts for this entry-level role." : "Add work, projects, or volunteering to show what you can do.";
  } else if (job.level === "experienced") {
    seniority = documentedYears !== null && documentedYears >= 3 ? 9 : 4;
    seniorityNote = documentedYears !== null && documentedYears >= 3 ? `Your profile documents about ${documentedYears} years of work.` : "This role is aimed at experienced hires.";
  }
  if (req.yearsExperience && req.yearsExperience >= 2 && job.level !== "internship") {
    if (documentedYears !== null && documentedYears >= req.yearsExperience) {
      seniority = 10;
      seniorityNote = `Your profile documents about ${documentedYears} years; the posting asks for ${req.yearsExperience}+.`;
    } else {
      seniority = Math.min(seniority, candidate.hasUndatedWork ? 5 : 3);
      seniorityNote = `The posting asks for ${req.yearsExperience}+ years. Your profile ${candidate.hasUndatedWork ? "has work without dates" : `documents ${documentedYears ?? 0}`}; add missing work history if you have it.`;
      experienceMissing.push(`${req.yearsExperience}+ years of experience requested`);
    }
  }
  points.experience = Math.min(25, relevance + seniority);
  const experienceWhy: Record<string, string> = {};
  for (const t of titleHits.slice(0, 3)) experienceWhy[t] = `Your ${t} role is the same kind of work as "${job.title}".`;
  for (const m of experienceMissing) experienceWhy[m] = seniorityNote;
  details.experience = {
    math: `Relevance ${relevance} of 15 + level ${seniority} of 10 = ${points.experience}`,
    why: experienceWhy,
    note: [
      titleHits.length
        ? `Your ${titleHits[0]} work lines up with this role.`
        : textHits.length
          ? "Some of your experience touches this kind of work."
          : "Your experience so far is in a different area.",
      seniorityNote,
    ]
      .filter(Boolean)
      .join(" "),
    matched: titleHits.slice(0, 3),
    missing: experienceMissing,
  };

  // ── Education (15)
  const studies = [candidate.major, candidate.minor, candidate.degree].filter(Boolean).join(" ").toLowerCase();
  const fieldMatch = req.degreeFields.length ? req.degreeFields.filter((f) => studies.includes(f.split(" ")[0])) : [];
  const fieldPoints = req.degreeFields.length ? (fieldMatch.length ? 8 : 0) : 8;
  const gpaOk = req.minGpa == null || candidate.gpa == null ? null : candidate.gpa >= req.minGpa;
  const gpaPoints = req.minGpa == null ? 4 : gpaOk ? 4 : gpaOk === false ? 0 : 1;
  const gradPoints = req.gradWindow ? (candidate.gradDate ? 3 : 1) : 3;
  points.education = Math.min(15, fieldPoints + gpaPoints + gradPoints);
  const educationWhy: Record<string, string> = {};
  for (const f of fieldMatch) educationWhy[f] = `Your ${candidate.major ?? candidate.degree ?? "degree"} matches a field they list.`;
  if (gpaOk) educationWhy[`GPA ${candidate.gpa} (min ${req.minGpa})`] = `Your ${candidate.gpa} clears their ${req.minGpa} minimum.`;
  if (req.degreeFields.length && !fieldMatch.length) educationWhy[`Degree in ${req.degreeFields.slice(0, 2).join(" or ")}`] = `They list ${req.degreeFields.slice(0, 3).join(", ")}; your ${candidate.major ?? "major"} isn't one of them.`;
  if (gpaOk === false) educationWhy[`GPA ${req.minGpa}+`] = `Their minimum is ${req.minGpa}; yours is ${candidate.gpa}.`;
  details.education = {
    math: `Field ${fieldPoints} of 8 + GPA ${gpaPoints} of 4 + graduation ${gradPoints} of 3 = ${points.education}`,
    why: educationWhy,
    note: [
      req.degreeFields.length
        ? fieldMatch.length
          ? `Your ${candidate.major ?? "degree"} matches what they list.`
          : `They list ${req.degreeFields.slice(0, 3).join(", ")}.`
        : "No specific field of study required.",
      req.minGpa != null ? (gpaOk === false ? `Minimum GPA ${req.minGpa}; yours is ${candidate.gpa}.` : gpaOk ? `Clears their ${req.minGpa} GPA minimum.` : `Minimum GPA ${req.minGpa}.`) : "",
    ]
      .filter(Boolean)
      .join(" "),
    matched: [...fieldMatch, ...(gpaOk ? [`GPA ${candidate.gpa} (min ${req.minGpa})`] : [])],
    missing: [...(req.degreeFields.length && !fieldMatch.length ? [`Degree in ${req.degreeFields.slice(0, 2).join(" or ")}`] : []), ...(gpaOk === false ? [`GPA ${req.minGpa}+`] : [])],
  };

  // ── Preferred skills (15)
  const prefCov = coverage(req.preferredGroups?.length ? req.preferredGroups : req.preferred.map((sk) => [sk]), index.skills);
  if (prefCov.ratio === null) {
    points.preferredSkills = 10;
    details.preferredSkills = { note: "No separate nice-to-have list.", matched: [], missing: [], math: "No nice-to-have list: neutral 10 of 15" };
  } else {
    points.preferredSkills = round(15 * prefCov.ratio);
    const total = prefCov.matched.length + prefCov.missing.length;
    details.preferredSkills = {
      note: `${prefCov.matched.length} of ${total} nice-to-haves.`,
      matched: prefCov.matched,
      missing: prefCov.missing,
      math: `15 × ${prefCov.matched.length}/${total} = ${points.preferredSkills}`,
      why: skillReasons(prefCov.matched, prefCov.missing, candidate, index, "preferred"),
    };
  }

  // ── Posting keyword overlap (10): the posting's own keyword phrases found in the profile
  if (job.keywords?.length) {
    const found = matchKeywords(job.keywords, index.keywordText);
    points.keywords = round(10 * (found.matched.length / job.keywords.length));
    const why: Record<string, string> = {};
    for (const k of found.matched) why[k] = "The posting uses it, and so do your facts.";
    for (const k of found.missing) why[k] = "The posting uses it; your facts don't. Only add it if it's true.";
    details.keywords = {
      note: `Your facts use ${found.matched.length} of the ${job.keywords.length} keywords in this posting.`,
      matched: found.matched,
      missing: found.missing,
      math: `10 × ${found.matched.length}/${job.keywords.length} = ${points.keywords}`,
      why,
    };
  } else {
    const keywords = [...new Set(req.mentioned.filter(isHardSkill))];
    const kwMatched = keywords.filter((k) => index.skills.has(k));
    points.keywords = keywords.length ? round(10 * (kwMatched.length / keywords.length)) : 6;
    details.keywords = {
      note: keywords.length ? `Your profile uses ${kwMatched.length} of the ${keywords.length} terms this posting repeats.` : "Few specific terms to match on.",
      matched: kwMatched.slice(0, 6),
      missing: keywords.filter((k) => !index.skills.has(k)).slice(0, 6),
      math: keywords.length ? `10 × ${kwMatched.length}/${keywords.length} = ${points.keywords}` : "Few terms: neutral 6 of 10",
    };
  }

  // ── Location and work mode (5)
  const places = candidate.targetLocations.filter((l) => !/^remote$/i.test(l)).map(resolvePlace).filter((p) => p !== null);
  const wantsRemote = candidate.workModes.includes("remote") || candidate.targetLocations.some((l) => /^remote$/i.test(l));
  const remoteJob = job.mode === "remote" || isRemoteText(job.location);
  const placeHit = places.find((p) => matchesPlace(job.location, p));
  const modeOk = !candidate.workModes.length || job.mode === "unknown" || candidate.workModes.includes(job.mode as "remote" | "hybrid" | "onsite");
  const locPoints = (remoteJob && wantsRemote) || placeHit ? 3 : places.length || wantsRemote ? 0 : 2;
  points.location = Math.min(5, locPoints + (modeOk ? 2 : 0));
  details.location = {
    math: `Place ${locPoints} of 3 + work mode ${modeOk ? 2 : 0} of 2 = ${points.location}`,
    note:
      remoteJob && wantsRemote
        ? "Remote, which you said works for you."
        : placeHit
          ? `In the ${placeHit.label}${job.mode !== "unknown" ? `, ${job.mode}` : ""}.`
          : job.location
            ? `${job.location}${places.length ? ", outside the places you picked" : ""}.`
            : "Location not listed.",
    matched: [...(placeHit ? [placeHit.label] : []), ...(remoteJob && wantsRemote ? ["Remote"] : []), ...(modeOk && job.mode !== "unknown" ? [job.mode] : [])],
    missing: !modeOk ? [`Prefers ${candidate.workModes.join(" or ")}`] : [],
  };

  // ── Eligibility gates
  if (req.gradWindow && candidate.gradDate) {
    const { from, to } = req.gradWindow;
    const early = from && monthsBetween(candidate.gradDate, from) > 1;
    const late = to && monthsBetween(to, candidate.gradDate) > 1;
    if (early || late) {
      gates.push({ reason: `Open to students graduating ${req.gradWindow.text.replace(/^graduat\w*\s*/i, "")}. You graduate ${formatMonth(candidate.gradDate) || candidate.gradDate}.`, cap: ELIGIBILITY_CAP });
    }
  }
  if (req.noSponsorship && candidate.needsSponsorship) {
    gates.push({ reason: "They don't sponsor visas, and you said you'll need sponsorship.", cap: 25 });
  }
  for (const license of req.licensesRequired) {
    if (!candidate.credentials.some((c) => c.toLowerCase().includes(license.toLowerCase()))) {
      gates.push({ reason: `Requires an active ${license}.`, cap: ELIGIBILITY_CAP });
    }
  }
  // Eligibility problems are knockouts (lib/fit/knockouts.ts), shown on their own and never blended into the score.
  const result = computeFit(points);

  const strengths = [
    ...reqCov.matched.slice(0, 2).map((s) => `${s}, which they ask for`),
    ...(titleHits.length ? [`Relevant experience: ${titleHits[0]}`] : []),
    ...(fieldMatch.length ? [`Your field of study (${candidate.major ?? candidate.degree}) fits`] : []),
    ...(placeHit ? [`Location works: ${placeHit.label}`] : []),
  ].slice(0, 4);
  // Eligibility problems are knockouts, listed on their own; gaps are what evidence could close.
  const gaps = [
    ...reqCov.missing.slice(0, 3),
    ...experienceMissing,
    ...prefCov.missing.filter((s) => !reqCov.missing.includes(s)).slice(0, 2).map((s) => `${s} (nice to have)`),
  ].slice(0, 5);

  const nextSteps = [
    ...(req.gradWindow && candidate.gradDate && gates.some((gate) => gate.reason.includes("You graduate"))
      ? ["This opening has a graduation window outside your date. Search for roles open to your graduation year or without a student-only window."]
      : []),
    ...(req.noSponsorship && candidate.needsSponsorship
      ? ["This employer says it will not sponsor visas. Focus on postings that explicitly allow the work authorization you need."]
      : []),
    ...req.licensesRequired.filter((license) => !candidate.credentials.some((credential) => credential.toLowerCase().includes(license.toLowerCase())))
      .map((license) => `This posting requires an active ${license}. Add it if you already hold it; otherwise look for a role that does not require it.`),
    ...(reqCov.missing.length ? [`The posting asks for ${reqCov.missing.slice(0, 2).join(" and ")}. Add a specific example if you have done this work. If you have not, learn or practice it before putting it on a resume.`] : []),
    ...(experienceMissing.length ? [`The posting asks for ${req.yearsExperience}+ years. Add dates for work already done; if you are short, compare roles with a lower experience requirement.`] : []),
    ...(details.education.missing.length ? [`Check the listed education requirement. Add a credential you hold, or look for roles that accept equivalent experience.`] : []),
    ...(!candidate.confirmedText.length ? ["Describe work, projects, or volunteering on your profile so the comparison has evidence to use."] : []),
  ].slice(0, 4);

  return { ...result, points, details, gates, strengths, gaps, nextSteps, requirementsInferred: req.requiredLines.length === 0 };
}

/** A quick relevance check used while searching, before full scoring: does the title fit the role words? */
export function titleMatches(title: string, roleWords: string[]): boolean {
  const t = title.toLowerCase();
  return roleWords.some((w) => new RegExp(`(?<![a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t));
}

export { familiesFor };
