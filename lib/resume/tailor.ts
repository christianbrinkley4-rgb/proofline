import { and, eq, isNull } from "drizzle-orm";
import { logEvent } from "@/lib/agent/events";
import { db, schema } from "@/lib/db";
import { extractSkills, skillCategory } from "@/lib/fit/skills";
import type { Requirements } from "@/lib/fit/requirements";
import { ROLE_FAMILIES } from "@/lib/jobs/roles";
import { hasUsableJobDescription, JOB_DESCRIPTION_REQUIRED } from "@/lib/jobs/description";
import { courseRelevance, postingOverlap } from "@/lib/jobs/relevance";
import { getJobForUser, requirementsOf } from "@/lib/jobs/store";
import { listExperiences, type Experience } from "@/lib/kb/experiences";
import { applyLooseHonors, readEducationRecords, type EducationRecord } from "@/lib/facts/base";
import { listFacts, type Fact } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { listBullets, type Bullet } from "./bullets/service";
import { nearDuplicate } from "./suggest";
import { educationAfterExperience } from "./section-order";
import { buildEducationSection, type EducationSource, type ResumeDocument, type ResumeEntry, type ResumeSection, type TemplateId, type VariantId } from "./document";
import { layoutResume, type LayoutResult } from "./layout";
import { resumeContactItems } from "./header-contact";
import { formatMonth, formatRange } from "./parse/dates";
import { dedupeSkills, polishBullet, roleEnded, skillName } from "./polish";
import { runQualityGate, type QualityCheck } from "./quality";
import { TEMPLATES, TIGHTEN_STEPS, type Template } from "./templates";
import { verifyBullet } from "./verify";

/** One key per skill, so "SQL (basic)" and "SQL" count as the same thing. */
const skillKey = skillName;

/**
 * Builds a one-page resume for one job (or a general one), from confirmed facts
 * and active bullets only. Explains every bullet it picked and every one it cut.
 */

export type WhyItem = { bulletId: string; text: string; addresses: string[]; reason: string };
export type CutItem = { bulletId: string | null; text: string; reason: string };
export type TailorResult = {
  document: ResumeDocument;
  template: Template;
  layout: LayoutResult;
  why: WhyItem[];
  cuts: CutItem[];
  checks: QualityCheck[];
  adjustments: string[];
};

type Scored = {
  bullet: Bullet;
  experience: Experience;
  relevance: number;
  quality: number;
  covers: string[];
  rank: number;
};

const SECTION_OF: Record<Experience["kind"], "Experience" | "Leadership and Activities" | "Projects"> = {
  work: "Experience",
  internship: "Experience",
  leadership: "Leadership and Activities",
  volunteer: "Leadership and Activities",
  project: "Projects",
  research: "Projects",
  education: "Leadership and Activities",
};

function recency(e: Experience): number {
  if (!e.endDate) return 1;
  const years = (Date.now() - new Date(`${e.endDate.length === 4 ? `${e.endDate}-06` : e.endDate}-01`).getTime()) / (365 * 864e5);
  return Math.max(0.2, 1 - years * 0.25);
}

function requirementLabels(req: Requirements | null) {
  const required = new Set((req?.requiredGroups ?? []).flat());
  const preferred = new Set((req?.preferredGroups ?? []).flat());
  const mentioned = new Set(req?.mentioned ?? []);
  return { required, preferred, mentioned };
}

type ResumeEducation = EducationSource & { factIds: EducationRecord["factIds"] };

/** Every confirmed school, with a profile-only school kept when no education facts exist yet. */
function educationForResume(
  facts: Array<Pick<Fact, "id" | "category" | "content" | "data">>,
  profile: { school?: string | null; degree?: string | null; major?: string | null; minor?: string | null; gradDate?: string | null; gpa?: number | null } | null | undefined,
): ResumeEducation[] {
  const records = applyLooseHonors(
    readEducationRecords(facts),
    facts.filter((f) => f.category === "award").map((f) => ({ id: f.id, content: f.content })),
  );
  const schools = records.filter((record) => record.school.trim());
  const loose = records.filter((record) => !record.school.trim());
  if (profile?.school && !schools.length) {
    schools.push({
      id: "profile",
      school: profile.school,
      degree: profile.degree ?? "",
      major: profile.major ?? "",
      gradDate: profile.gradDate ? formatMonth(profile.gradDate) : "",
      gradMonth: profile.gradDate ?? null,
      gpa: profile.gpa != null ? String(profile.gpa) : "",
      honors: "",
      coursework: "",
      extras: [],
      factIds: { honors: [], extras: [] },
    });
  }
  if (schools[0] && loose.length) {
    const first = schools[0];
    const extras = [...first.extras];
    const extraIds = [...first.factIds.extras];
    let { coursework, honors } = first;
    let courseworkId = first.factIds.coursework;
    let honorsIds = first.factIds.honors;
    for (const extra of loose) {
      if (!coursework && extra.coursework) {
        coursework = extra.coursework;
        courseworkId = extra.factIds.coursework;
      }
      if (!honors && extra.honors) {
        honors = extra.honors;
        honorsIds = extra.factIds.honors;
      }
      extras.push(...extra.extras);
      extraIds.push(...extra.factIds.extras);
    }
    schools[0] = { ...first, coursework, honors, extras, factIds: { ...first.factIds, coursework: courseworkId, honors: honorsIds, extras: extraIds } };
  }
  let minorUsed = false;
  return schools.map((record) => {
    const takeMinor = !minorUsed && Boolean(profile?.minor) && record.school === profile?.school;
    if (takeMinor) minorUsed = true;
    return { ...record, minor: takeMinor ? (profile?.minor ?? "") : "" };
  });
}

export async function tailorResume(
  userId: string,
  opts: { jobId?: string | null; template?: TemplateId; variant?: VariantId; email: string },
): Promise<TailorResult> {
  const variant = opts.variant ?? "experience";
  const [profile, experiences, bullets, facts, job] = await Promise.all([
    getProfile(userId),
    listExperiences(userId),
    listBullets(userId),
    listFacts(userId, { states: ["confirmed"] }),
    opts.jobId ? getJobForUser(userId, opts.jobId).then((data) => data?.job ?? null) : Promise.resolve(null),
  ]);
  if (opts.jobId && !job) throw new Error("Job not found.");
  if (job && !hasUsableJobDescription(job.description)) throw new Error(JOB_DESCRIPTION_REQUIRED);
  const req = job ? requirementsOf(job) : null;
  const labels = requirementLabels(req);
  const familyWords = job ? ROLE_FAMILIES.filter((f) => f.titleWords.some((w) => job.title.toLowerCase().includes(w))).flatMap((f) => f.titleWords) : [];

  const expById = new Map(experiences.map((e) => [e.id, e]));
  const confirmed = new Map(facts.map((f) => [f.id, f.content]));
  const supported = (b: Bullet) => b.factIds.length > 0 && b.factIds.every((id) => confirmed.has(id)) && verifyBullet(b.text, b.factIds.map((id) => confirmed.get(id)!)).ok;
  const active = bullets.filter((b) => b.status === "active" && expById.has(b.experienceId) && supported(b));
  const stale = bullets.filter((b) => b.status === "active" && expById.has(b.experienceId) && !supported(b));
  const drafts = bullets.filter((b) => b.status === "draft" && expById.has(b.experienceId));

  // ── Score every active bullet for this job
  const scored: Scored[] = active.map((bullet) => {
    const skills = extractSkills(bullet.text);
    const covers = [
      ...skills.filter((s) => labels.required.has(s)).map((s) => `${s} (required)`),
      ...skills.filter((s) => labels.preferred.has(s) && !labels.required.has(s)).map((s) => `${s} (preferred)`),
      ...skills.filter((s) => labels.mentioned.has(s) && !labels.required.has(s) && !labels.preferred.has(s)),
    ];
    const words = familyWords.filter((w) => bullet.text.toLowerCase().includes(w)).length;
    const relevance = job
      ? skills.filter((s) => labels.required.has(s)).length * 3 + skills.filter((s) => labels.preferred.has(s)).length * 2 + skills.filter((s) => labels.mentioned.has(s)).length + Math.min(words, 2) + postingOverlap(bullet.text, job.description) * 2
      : skills.length * 0.5;
    const quality = (bullet.score ?? 60) / 100 + (bullet.favorite ? 0.15 : 0);
    const experience = expById.get(bullet.experienceId)!;
    const kindWeight = SECTION_OF[experience.kind] === "Experience" ? 1 : 0.8;
    const rel = Math.min(relevance / 8, 1);
    const rank =
      variant === "skills"
        ? 0.65 * rel + 0.25 * quality + 0.1 * recency(experience)
        : variant === "ats"
          ? 0.55 * rel + 0.3 * quality + 0.15 * recency(experience)
          : 0.45 * rel + 0.3 * quality + 0.25 * recency(experience) * kindWeight;
    return { bullet, experience, relevance, quality, covers, rank };
  });

  // ── Keyword match variant: greedily prefer bullets that add terms not yet covered
  if (variant === "ats" && req) {
    const covered = new Set<string>();
    const remaining = [...scored].sort((a, b) => b.rank - a.rank);
    let order = 0;
    while (remaining.length) {
      remaining.sort((a, b) => {
        const gain = (s: Scored) => extractSkills(s.bullet.text).filter((k) => labels.mentioned.has(k) && !covered.has(k)).length;
        return gain(b) - gain(a) || b.rank - a.rank;
      });
      const next = remaining.shift()!;
      extractSkills(next.bullet.text).forEach((k) => covered.add(k));
      next.rank = 10 - order++ * 0.01;
    }
  }

  // ── Initial selection: caps per role, most relevant experiences get more room
  const byExperience = new Map<string, Scored[]>();
  for (const s of scored) byExperience.set(s.experience.id, [...(byExperience.get(s.experience.id) ?? []), s]);
  for (const list of byExperience.values()) list.sort((a, b) => b.rank - a.rank);
  const expOrder = [...byExperience.entries()]
    .map(([id, list]) => ({ id, top: list[0].rank + list.slice(0, 3).reduce((s, x) => s + x.rank, 0) / 3 }))
    .sort((a, b) => b.top - a.top);

  const selected = new Map<string, Scored[]>();
  const cuts: CutItem[] = [];
  const selectedTexts: string[] = [];
  for (const b of stale) cuts.push({ bulletId: b.id, text: b.text, reason: "What this line came from changed or was removed. Check it in My experience." });
  expOrder.forEach(({ id }, index) => {
    const list = byExperience.get(id)!;
    const exp = expById.get(id)!;
    const cap = SECTION_OF[exp.kind] === "Experience" ? (index === 0 ? 5 : 4) : 2;
    const keep: Scored[] = [];
    for (const candidate of list) {
      if (selectedTexts.some((text) => nearDuplicate(text, candidate.bullet.text))) {
        cuts.push({ bulletId: candidate.bullet.id, text: candidate.bullet.text, reason: "Another bullet on this page describes the same work more clearly." });
        continue;
      }
      if (keep.length < cap) {
        keep.push(candidate);
        selectedTexts.push(candidate.bullet.text);
      } else {
        cuts.push({ bulletId: candidate.bullet.id, text: candidate.bullet.text, reason: `${exp.org} already has ${cap} stronger bullets for this job.` });
      }
    }
    selected.set(id, keep);
  });
  for (const d of drafts) {
    cuts.push({ bulletId: d.id, text: d.text, reason: "Waiting on your OK, so it can't go on a resume yet. Answer the question on your profile." });
  }

  // ── Build, then fit to one page: tighten spacing first, then cut the weakest bullets
  const template = TEMPLATES[opts.template ?? "classic"];
  const adjustments: string[] = [];
  const confirmedSkills = facts.filter((f) => f.category === "skill" || f.category === "tool").map((f) => f.content);
  const certs = facts.filter((f) => f.category === "certification").map((f) => f.content);
  const educationRecords = educationForResume(facts, profile);
  const roleCount = experiences.filter((e) => e.kind !== "education").length;
  const showCoursework = (text: string) => roleCount < 3 || Boolean(req && extractSkills(text).some((s) => labels.mentioned.has(s))) || Boolean(req?.degreeFields.length);

  const build = (): ResumeDocument => {
    const sections: ResumeSection[] = [];
    const sourceFactIds = new Set<string>();
    // Education first for students and recent grads (see RESUME-STANDARDS.md).
    const educationEntries = buildEducationSection(educationRecords, { showCoursework, courseRelevance: job ? (course) => courseRelevance(course, job.description) : undefined });
    if (educationEntries.length) {
      sections.push({ kind: "education", title: "Education", entries: educationEntries });
      educationRecords.forEach((record, index) => {
        const entry = educationEntries[index];
        if (!entry) return;
        if (record.factIds.school) sourceFactIds.add(record.factIds.school);
        if (entry.degreeLine) {
          if (record.factIds.degree) sourceFactIds.add(record.factIds.degree);
          if (record.factIds.major) sourceFactIds.add(record.factIds.major);
        }
        if (entry.gradLine && record.factIds.grad) sourceFactIds.add(record.factIds.grad);
        for (const line of entry.details) {
          if (line.startsWith("GPA") && record.factIds.gpa) sourceFactIds.add(record.factIds.gpa);
          if (record.honors && line.includes(record.honors)) record.factIds.honors.forEach((id) => sourceFactIds.add(id));
          if (line.startsWith("Relevant coursework") && record.factIds.coursework) sourceFactIds.add(record.factIds.coursework);
        }
        record.factIds.extras.forEach((id) => sourceFactIds.add(id));
      });
    }

    for (const title of ["Experience", "Leadership and Activities", "Projects"] as const) {
      const entries: ResumeEntry[] = experiences
        .filter((e) => SECTION_OF[e.kind] === title && (selected.get(e.id)?.length ?? 0) > 0)
        .map((e) => ({
          experienceId: e.id,
          org: e.org,
          title: e.title,
          location: e.location,
          dates: e.startDate || e.endDate ? formatRange(e.startDate, e.endDate) : "",
          // Form only: tense for past roles, spacing, capitals. Numbers and claims stay exactly as confirmed.
          bullets: selected.get(e.id)!.map((s) => ({ id: s.bullet.id, text: polishBullet(s.bullet.text, { ended: roleEnded(e.startDate || e.endDate ? formatRange(e.startDate, e.endDate) : "") }), factIds: s.bullet.factIds })),
        }));
      if (entries.length) sections.push({ kind: "entries", title, entries });
    }

    const explicitCanonical = new Set(confirmedSkills.flatMap(extractSkills));
    const evidenceSkills = variant === "skills" || variant === "ats"
      ? [...new Set([...selected.values()].flat().flatMap((item) => extractSkills(item.bullet.text)))].filter((skill) => !explicitCanonical.has(skill))
      : [];
    if (evidenceSkills.length) [...selected.values()].flat().forEach((item) => item.bullet.factIds.forEach((id) => sourceFactIds.add(id)));
    // Soft skills ("Leadership") are shown by the bullets, never listed; career centers and recruiters agree a list proves nothing.
    const listable = (name: string) => !["language", "soft"].includes(skillCategory(name) ?? "");
    const technical = [...confirmedSkills.filter((s) => listable(extractSkills(s)[0] ?? "")), ...evidenceSkills.filter(listable)];
    const languages = confirmedSkills.filter((s) => skillCategory(extractSkills(s)[0] ?? "") === "language");
    const relevantFirst = (items: string[]) =>
      [...items].sort((a, b) => Number(extractSkills(b).some((k) => labels.mentioned.has(k))) - Number(extractSkills(a).some((k) => labels.mentioned.has(k))));
    const lines = [
      { label: "Technical", items: dedupeSkills(relevantFirst(technical), skillKey).slice(0, 12) },
      { label: "Languages", items: dedupeSkills(languages, skillKey) },
      { label: "Certifications", items: certs },
    ].filter((l) => l.items.length);
    if (lines.length) {
      const section: ResumeSection = { kind: "skills", title: "Skills", lines };
      if (variant === "skills") sections.splice(sections[0]?.kind === "education" ? 1 : 0, 0, section);
      else sections.push(section);
    }
    const latestGrad = educationRecords.map((record) => record.gradMonth).filter((month): month is string => Boolean(month)).sort().at(-1) ?? profile?.gradDate ?? null;
    if (sections[0]?.kind === "education" && educationAfterExperience(
      latestGrad,
      experiences.filter((experience) => (selected.get(experience.id)?.length ?? 0) > 0),
    )) {
      const [education] = sections.splice(0, 1);
      const trailingSkills = sections.at(-1)?.kind === "skills";
      sections.splice(trailingSkills ? sections.length - 1 : sections.length, 0, education);
    }
    // Merged lines ("Excel (pivot tables, XLOOKUP, VLOOKUP)") still trace to every fact behind them.
    const included = new Set(lines.flatMap((line) => line.items.map(skillKey)));
    facts.filter((f) => ["skill", "tool", "certification"].includes(f.category) && included.has(skillKey(f.content))).forEach((f) => sourceFactIds.add(f.id));

    return {
      sourceFactIds: [...sourceFactIds],
      header: {
        name: profile?.fullName ?? "",
        contact: resumeContactItems(profile),
      },
      sections,
    };
  };

  let document = build();
  let activeTemplate: Template = template;
  let layout = await layoutResume(document, template);
  for (const step of TIGHTEN_STEPS.slice(1)) {
    if (!layout.overflow) break;
    activeTemplate = { ...template, ...step };
    layout = await layoutResume(document, activeTemplate);
    adjustments.push("Tightened spacing (still inside career-center guidelines) to fit one page.");
  }

  let guard = 0;
  while (layout.overflow && guard++ < 60) {
    const candidates = [...selected.entries()].flatMap(([id, list]) => list.map((s) => ({ id, s, only: list.length === 1 })));
    const cuttable = candidates.filter((c) => !c.only).sort((a, b) => a.s.rank - b.s.rank);
    if (cuttable.length) {
      const victim = cuttable[0];
      selected.set(victim.id, selected.get(victim.id)!.filter((s) => s !== victim.s));
      cuts.push({
        bulletId: victim.s.bullet.id,
        text: victim.s.bullet.text,
        reason: victim.s.covers.length
          ? `Lost the last spot on the page. It covers ${victim.s.covers[0].replace(/ \(.*\)$/, "")}, but the bullets that stayed cover more.`
          : "Cut to keep it to one page. It covered the least of what this job asks for.",
      });
    } else {
      // Every role is down to one bullet: drop the least relevant role entirely.
      const weakest = [...selected.entries()].filter(([, l]) => l.length).sort((a, b) => a[1][0].rank - b[1][0].rank)[0];
      if (!weakest) break;
      const exp = expById.get(weakest[0])!;
      for (const s of weakest[1]) cuts.push({ bulletId: s.bullet.id, text: s.bullet.text, reason: `Left ${exp.org} off to keep it to one page. It covered the least of this posting.` });
      selected.set(weakest[0], []);
    }
    document = build();
    layout = await layoutResume(document, activeTemplate);
  }

  // ── Why each bullet made it
  const chosen = [...selected.values()].flat();
  const cutByExperience = new Map<string, CutItem[]>();
  for (const c of cuts) {
    const exp = c.bulletId ? bullets.find((b) => b.id === c.bulletId)?.experienceId : undefined;
    if (exp) cutByExperience.set(exp, [...(cutByExperience.get(exp) ?? []), c]);
  }
  const why: WhyItem[] = chosen.map((s) => {
    const beat = cutByExperience.get(s.experience.id)?.[0];
    const detail = (s.bullet.score ?? 0) >= 85 ? " Its clear action and concrete detail make it a stronger example." : "";
    const reason = s.covers.length
      ? `Shows ${s.covers.slice(0, 2).map((c) => c.replace(/ \(.*\)$/, "")).join(" and ")}, which the posting asks for.${detail}`
      : job
        ? `Adds a confirmed example from ${s.experience.org}, though it does not directly match a stated requirement.${detail}`
        : `Shows work you confirmed at ${s.experience.org}.${detail}`;
    return {
      bulletId: s.bullet.id,
      text: s.bullet.text,
      addresses: s.covers,
      reason: beat ? `${reason} Picked over "${beat.text.slice(0, 60)}${beat.text.length > 60 ? "..." : ""}".` : reason,
    };
  });

  const factText = new Map(facts.map((f) => [f.id, f.content]));
  const checks = runQualityGate(document, layout, factText, new Set(active.map((b) => b.id)), req);
  return { document, template: activeTemplate, layout, why, cuts, checks, adjustments };
}

export async function saveTailoredResume(
  userId: string,
  jobId: string | null,
  result: TailorResult,
  opts: { variant: VariantId; name: string },
) {
  const previous = await db.query.resume.findMany({
    where: and(eq(schema.resume.userId, userId), jobId ? eq(schema.resume.jobId, jobId) : isNull(schema.resume.jobId)),
    columns: { id: true },
  });
  const [row] = await db
    .insert(schema.resume)
    .values({
      userId,
      jobId,
      name: opts.name,
      template: result.template.id,
      variant: opts.variant,
      content: { document: result.document, templateOverrides: result.template, adjustments: result.adjustments } as unknown as Record<string, unknown>,
      why: { items: result.why } as unknown as Record<string, unknown>,
      cuts: { items: result.cuts } as unknown as Record<string, unknown>,
      checks: { items: result.checks, remaining: result.layout.remaining } as unknown as Record<string, unknown>,
      version: previous.length + 1,
    })
    .returning();
  await logEvent(userId, "resume_tailored", { resumeId: row.id, jobId, variant: opts.variant, template: result.template.id, bullets: result.why.length, cuts: result.cuts.length });
  return row;
}
