import { familiesFor, ROLE_FAMILIES } from "@/lib/jobs/roles";
import { isRemoteText, matchesPlace, resolvePlace } from "@/lib/jobs/locations";
import type { JobLevel, JobMode } from "@/lib/jobs/types";
import type { Requirements } from "./requirements";
import { computeFit, ELIGIBILITY_CAP, type EligibilityGate, type FitComponentKey, type FitPoints, type FitResult } from "./rubric";
import { extractSkills, isHardSkill } from "./skills";

/**
 * Scores one student against one posting with the six-part rubric, rules only.
 * Every component says what matched and what's missing, and hard requirements
 * the student can't meet become eligibility gates that cap the score.
 */

export type CandidateProfile = {
  /** Every confirmed fact and active bullet, as plain text. */
  confirmedText: string[];
  experienceTitles: string[];
  hasInternship: boolean;
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
};

export type ComponentDetail = { note: string; matched: string[]; missing: string[] };

export type FitReport = FitResult & {
  points: FitPoints;
  details: Record<FitComponentKey, ComponentDetail>;
  gates: EligibilityGate[];
  strengths: string[];
  gaps: string[];
};

export type CandidateIndex = { skills: Set<string>; corpus: string };

export function indexCandidate(c: CandidateProfile): CandidateIndex {
  const corpus = [...c.confirmedText, ...c.experienceTitles, c.major ?? "", c.minor ?? "", ...c.credentials].join("\n");
  return { skills: new Set(extractSkills(corpus)), corpus: corpus.toLowerCase() };
}

const round = (n: number) => Math.round(n);

/** Coverage by requirement: a group is met when the student has any skill in it ("Excel or Google Sheets"). */
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
  const reqGroups = req.requiredGroups?.length ? req.requiredGroups : (req.required.length ? req.required : req.mentioned).map((sk) => [sk]);
  const reqCov = coverage(reqGroups, index.skills);
  if (reqCov.ratio === null) {
    points.requiredSkills = 20;
    details.requiredSkills = { note: "The posting doesn't list specific skills, so this is a neutral score.", matched: [], missing: [] };
  } else {
    points.requiredSkills = round(30 * reqCov.ratio);
    const total = reqCov.matched.length + reqCov.missing.length;
    details.requiredSkills = {
      note: `Covers ${reqCov.matched.length} of the ${total} skill requirements.`,
      matched: reqCov.matched,
      missing: reqCov.missing,
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
  if (job.level === "internship") {
    seniority = 10;
    seniorityNote = "Internships are built for where you are.";
  } else if (job.level === "entry") {
    seniority = candidate.hasInternship ? 9 : 7;
    seniorityNote = candidate.hasInternship ? "Entry level, and you have internship experience." : "Entry level. An internship would make this stronger.";
  } else if (job.level === "experienced") {
    seniority = 1;
    seniorityNote = "This role is aimed at experienced hires.";
  }
  if (req.yearsExperience && req.yearsExperience >= 2 && job.level !== "internship") {
    seniority = Math.min(seniority, 2);
    seniorityNote = `Asks for ${req.yearsExperience}+ years of experience.`;
  }
  points.experience = Math.min(25, relevance + seniority);
  details.experience = {
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
    missing: req.yearsExperience && req.yearsExperience >= 2 ? [`${req.yearsExperience}+ years of experience`] : [],
  };

  // ── Education (15)
  const studies = [candidate.major, candidate.minor, candidate.degree].filter(Boolean).join(" ").toLowerCase();
  const fieldMatch = req.degreeFields.length ? req.degreeFields.filter((f) => studies.includes(f.split(" ")[0])) : [];
  const fieldPoints = req.degreeFields.length ? (fieldMatch.length ? 8 : studies ? 2 : 4) : 6;
  const gpaOk = req.minGpa == null || candidate.gpa == null ? null : candidate.gpa >= req.minGpa;
  const gpaPoints = gpaOk === false ? 0 : req.minGpa != null && gpaOk ? 4 : 3;
  const degreePoints = studies ? 3 : 1;
  points.education = Math.min(15, fieldPoints + gpaPoints + degreePoints + (req.degreeFields.length ? 0 : 1));
  details.education = {
    note: [
      req.degreeFields.length
        ? fieldMatch.length
          ? `Your ${candidate.major ?? "degree"} matches what they list.`
          : `They list ${req.degreeFields.slice(0, 3).join(", ")}.`
        : "No specific major required.",
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
    details.preferredSkills = { note: "No separate nice-to-have list.", matched: [], missing: [] };
  } else {
    points.preferredSkills = round(15 * prefCov.ratio);
    details.preferredSkills = {
      note: `${prefCov.matched.length} of ${prefCov.matched.length + prefCov.missing.length} nice-to-haves.`,
      matched: prefCov.matched,
      missing: prefCov.missing,
    };
  }

  // ── Keyword and ATS overlap (10)
  const keywords = [...new Set(req.mentioned.filter(isHardSkill))];
  const kwMatched = keywords.filter((k) => index.skills.has(k));
  points.keywords = keywords.length ? round(10 * (kwMatched.length / keywords.length)) : 6;
  details.keywords = {
    note: keywords.length ? `Your profile uses ${kwMatched.length} of the ${keywords.length} terms this posting repeats.` : "Few specific terms to match on.",
    matched: kwMatched.slice(0, 6),
    missing: keywords.filter((k) => !index.skills.has(k)).slice(0, 6),
  };

  // ── Location and work mode (5)
  const places = candidate.targetLocations.filter((l) => !/^remote$/i.test(l)).map(resolvePlace).filter((p) => p !== null);
  const wantsRemote = candidate.workModes.includes("remote") || candidate.targetLocations.some((l) => /^remote$/i.test(l));
  const remoteJob = job.mode === "remote" || isRemoteText(job.location);
  const placeHit = places.find((p) => matchesPlace(job.location, p));
  const modeOk = !candidate.workModes.length || job.mode === "unknown" || candidate.workModes.includes(job.mode as "remote" | "hybrid" | "onsite");
  const locPoints = (remoteJob && wantsRemote) || placeHit ? 3 : places.length || wantsRemote ? 0 : 2;
  points.location = Math.min(5, locPoints + (modeOk ? 2 : 0));
  details.location = {
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
      gates.push({ reason: `Open to students graduating ${req.gradWindow.text.replace(/^graduat\w*\s*/i, "")}. You graduate ${candidate.gradDate}.`, cap: ELIGIBILITY_CAP });
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
  if (req.yearsExperience && req.yearsExperience >= 3 && job.level !== "internship") {
    gates.push({ reason: `Asks for ${req.yearsExperience}+ years of full-time experience.`, cap: 50 });
  }

  const result = computeFit(points, gates);

  const strengths = [
    ...reqCov.matched.slice(0, 2).map((s) => `${s}, which they ask for`),
    ...(titleHits.length ? [`Relevant experience: ${titleHits[0]}`] : []),
    ...(fieldMatch.length ? [`Your major (${candidate.major}) fits`] : []),
    ...(placeHit ? [`Location works: ${placeHit.label}`] : []),
  ].slice(0, 4);
  const gaps = [
    ...gates.map((g) => g.reason),
    ...reqCov.missing.slice(0, 3),
    ...prefCov.missing.slice(0, 2).map((s) => `${s} (nice to have)`),
  ].slice(0, 5);

  return { ...result, points, details, gates, strengths, gaps };
}

/** A quick relevance check used while searching, before full scoring: does the title fit the role words? */
export function titleMatches(title: string, roleWords: string[]): boolean {
  const t = title.toLowerCase();
  return roleWords.some((w) => new RegExp(`(?<![a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t));
}

export { familiesFor };
