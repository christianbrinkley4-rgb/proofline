import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { archiveExperience, createExperience, getExperience, listExperiences, updateExperience, type Experience, type ExperienceKind } from "@/lib/kb/experiences";
import { addFact, listFacts, rejectFact, reviseFact, type Fact, type FactCategory } from "@/lib/kb/facts";
import { getProfile, updateProfile } from "@/lib/kb/profile";
import { scoreBullet } from "@/lib/resume/bullet-score";
import { formatMonth } from "@/lib/resume/parse/dates";

/**
 * The fact base: the user's source of truth, and the only thing a resume may
 * claim. Every write here is something the user typed and explicitly confirmed,
 * stored in their exact words. Facts are never invented or inferred.
 *
 * Storage is the append-only `fact` table (view `facts` gives the spec's shape).
 * Education fields mirror onto `profile`, role fields onto `experience`, and each
 * bullet fact gets one active `bullet` that cites it, because the tailoring engine
 * reads those tables. This module keeps all of them in step.
 */

export const FACT_GROUPS = ["education", "experience", "project", "skill", "license", "number"] as const;
export type FactGroup = (typeof FACT_GROUPS)[number];

export const GROUP_LABEL: Record<FactGroup, string> = {
  education: "Education",
  experience: "Experience",
  project: "Projects",
  skill: "Skills",
  license: "Licenses and certifications",
  number: "Numbers and results",
};

export type EducationField = "school" | "degree" | "major" | "grad_date" | "gpa" | "detail";
export type RoleField = "org" | "title" | "dates" | "location" | "bullet";
export type FactField = EducationField | RoleField | "item";

export const FIELD_LABEL: Record<FactField, string> = {
  school: "School",
  degree: "Degree",
  major: "Major",
  grad_date: "Graduation",
  gpa: "GPA",
  detail: "Detail",
  org: "Organization",
  title: "Title",
  dates: "Dates",
  location: "Location",
  bullet: "Bullet",
  item: "Item",
};

const PROJECT_KINDS: ExperienceKind[] = ["project", "research"];

export function fieldOf(fact: Pick<Fact, "data">): FactField | null {
  const field = (fact.data as { field?: unknown } | null)?.field;
  return typeof field === "string" && field in FIELD_LABEL ? (field as FactField) : null;
}

/** Which of the six groups a stored fact belongs to. */
export function groupOf(fact: Pick<Fact, "category">, experienceKind?: ExperienceKind | null): FactGroup {
  if (experienceKind && PROJECT_KINDS.includes(experienceKind)) return "project";
  switch (fact.category) {
    case "education":
      return "education";
    case "project":
      return "project";
    case "skill":
    case "tool":
      return "skill";
    case "certification":
      return "license";
    case "metric":
      return "number";
    default:
      return "experience";
  }
}

/** The stored category for a new fact in a group. */
export function categoryFor(group: FactGroup): FactCategory {
  return ({ education: "education", experience: "experience", project: "project", skill: "skill", license: "certification", number: "metric" } as const)[group];
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();
/** Bullet text as the resume uses it: the user's words, minus a trailing period. */
const bulletText = (text: string) => clean(text).replace(/[.\s]+$/, "");

export function datesText(start: string | null | undefined, end: string | null | undefined): string {
  const from = formatMonth(start);
  const to = end ? formatMonth(end) : "Present";
  return from ? `${from} to ${to}` : end ? formatMonth(end) : "";
}

// ─── Writing ──────────────────────────────────────────────────────────────────

/** One confirmed bullet fact and the active resume bullet that cites it. */
export async function addBulletFact(userId: string, experience: Pick<Experience, "id" | "kind">, text: string, sourceDetail: string) {
  const content = bulletText(text);
  if (content.length < 3) return null;
  const fact = await addFact(userId, {
    category: PROJECT_KINDS.includes(experience.kind) ? "project" : "experience",
    content,
    data: { field: "bullet" },
    experienceId: experience.id,
    source: "user_stated",
    sourceDetail,
  });
  const { score, checks } = scoreBullet(content);
  const [bullet] = await db
    .insert(schema.bullet)
    .values({ userId, experienceId: experience.id, text: content, status: "active", factIds: [fact.id], score, scoreDetail: { checks, verified: true, unsupported: [] }, generator: "user" })
    .returning();
  return { fact, bullet };
}

/** Writes a single-valued field fact: adds it, supersedes a changed one, or rejects a cleared one. */
async function setFieldFact(
  userId: string,
  existing: Fact[],
  field: FactField,
  value: string,
  base: { category: FactCategory; experienceId?: string | null; sourceDetail: string },
) {
  const text = clean(value);
  const current = existing.find((f) => fieldOf(f) === field && (base.experienceId ? f.experienceId === base.experienceId : true));
  if (current && current.content === text) return current;
  if (current && !text) {
    await rejectFact(userId, current.id, "cleared by the user");
    return null;
  }
  if (current) return reviseFact(userId, current.id, { content: text, data: { field }, source: "user_stated" });
  if (!text) return null;
  return addFact(userId, { category: base.category, content: text, data: { field }, experienceId: base.experienceId ?? null, source: "user_stated", sourceDetail: base.sourceDetail });
}

export type EducationInput = { school: string; degree: string; major: string; gradDate: string; gpa: string };

export async function saveEducation(userId: string, input: EducationInput, sourceDetail = "onboarding") {
  const existing = await listFacts(userId, { states: ["confirmed"], categories: ["education"] });
  await updateProfile(userId, {
    school: clean(input.school) || null,
    degree: clean(input.degree) || null,
    major: clean(input.major) || null,
    gradDate: input.gradDate || null,
    gpa: input.gpa ? Number(input.gpa) : null,
  });
  const base = { category: "education" as const, sourceDetail };
  await setFieldFact(userId, existing, "school", input.school, base);
  await setFieldFact(userId, existing, "degree", input.degree, base);
  await setFieldFact(userId, existing, "major", input.major, base);
  await setFieldFact(userId, existing, "grad_date", input.gradDate ? formatMonth(input.gradDate) : "", base);
  await setFieldFact(userId, existing, "gpa", input.gpa, base);
}

export type RoleInput = {
  experienceId?: string | null;
  kind: ExperienceKind;
  org: string;
  title: string;
  location?: string;
  startDate: string;
  endDate: string;
  /** New bullets to add, in the user's words. */
  bullets: string[];
};

/** Creates or updates one role or project and its field facts, then adds any new bullets. */
export async function saveRole(userId: string, input: RoleInput, sourceDetail = "onboarding"): Promise<Experience> {
  const fields = { kind: input.kind, org: clean(input.org), title: clean(input.title) || null, location: clean(input.location ?? "") || null, startDate: input.startDate || null, endDate: input.endDate || null };
  const experience = input.experienceId
    ? await updateExperience(userId, input.experienceId, fields).then((row) => {
        if (!row) throw new Error("That role isn't on your profile anymore.");
        return row;
      })
    : await createExperience(userId, fields);
  const existing = await listFacts(userId, { states: ["confirmed"], experienceId: experience.id });
  const base = { category: (PROJECT_KINDS.includes(experience.kind) ? "project" : "experience") as FactCategory, experienceId: experience.id, sourceDetail };
  await setFieldFact(userId, existing, "org", experience.org, base);
  await setFieldFact(userId, existing, "title", experience.title ?? "", base);
  await setFieldFact(userId, existing, "location", experience.location ?? "", base);
  await setFieldFact(userId, existing, "dates", experience.startDate || experience.endDate ? datesText(experience.startDate, experience.endDate) : "", base);
  for (const text of input.bullets) await addBulletFact(userId, experience, text, sourceDetail);
  return experience;
}

/** Skills or licenses, one fact each, skipping ones already confirmed. */
export async function addListFacts(userId: string, group: "skill" | "license", items: string[], sourceDetail = "onboarding") {
  const category = categoryFor(group);
  const current = await listFacts(userId, { states: ["confirmed"], categories: group === "skill" ? ["skill", "tool"] : ["certification"] });
  const known = new Set(current.map((f) => f.content.toLowerCase()));
  const added: Fact[] = [];
  for (const raw of items) {
    const text = clean(raw);
    if (!text || known.has(text.toLowerCase())) continue;
    known.add(text.toLowerCase());
    added.push(await addFact(userId, { category, content: text, data: { field: "item" }, source: "user_stated", sourceDetail }));
  }
  return added;
}

/** Manual add from My facts. The caller has already checked the user ticked "this is true". */
export async function addManualFact(userId: string, input: { group: FactGroup; text: string; experienceId?: string | null }) {
  const text = clean(input.text);
  if (text.length < 2) throw new Error("Write the fact first.");
  if (input.group === "experience" || input.group === "project") {
    const experience = input.experienceId ? await getExperience(userId, input.experienceId) : undefined;
    if (!experience || experience.archivedAt) throw new Error("Pick the role or project this belongs to.");
    return (await addBulletFact(userId, experience, text, "my-facts"))?.fact ?? null;
  }
  if (input.group === "skill" || input.group === "license") return (await addListFacts(userId, input.group, [text], "my-facts"))[0] ?? null;
  return addFact(userId, { category: categoryFor(input.group), content: text, data: { field: input.group === "education" ? "detail" : "item" }, source: "user_stated", sourceDetail: "my-facts" });
}

// ─── Editing and deleting ─────────────────────────────────────────────────────

/** Archives every active bullet that cites a fact, so nothing on a resume outlives its source. */
async function archiveBulletsCiting(userId: string, factId: string) {
  const bullets = await db.query.bullet.findMany({ where: and(eq(schema.bullet.userId, userId), inArray(schema.bullet.status, ["active", "draft"])) });
  const hit = bullets.filter((b) => b.factIds.includes(factId));
  if (hit.length) await db.update(schema.bullet).set({ status: "archived" }).where(inArray(schema.bullet.id, hit.map((b) => b.id)));
  return hit;
}

const PROFILE_FIELD: Partial<Record<FactField, "school" | "degree" | "major" | "gradDate" | "gpa">> = {
  school: "school",
  degree: "degree",
  major: "major",
  grad_date: "gradDate",
  gpa: "gpa",
};

/** Mirrors an education field onto the profile columns the resume reads. */
async function syncProfileField(userId: string, field: FactField, text: string | null) {
  const column = PROFILE_FIELD[field];
  if (!column) return;
  if (column === "gpa") {
    const value = text ? Number(text.match(/[0-4](?:\.\d{1,2})?/)?.[0]) : NaN;
    await updateProfile(userId, { gpa: Number.isFinite(value) ? value : null });
  } else if (column === "gradDate") {
    const month = text ? (text.match(/^(\d{4})-(\d{2})$/)?.[0] ?? toYearMonth(text)) : null;
    await updateProfile(userId, { gradDate: month });
  } else {
    await updateProfile(userId, { [column]: text });
  }
}

function toYearMonth(text: string): string | null {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const m = text.toLowerCase().match(/([a-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m && months.includes(m[1])) return `${m[2]}-${String(months.indexOf(m[1]) + 1).padStart(2, "0")}`;
  return text.match(/\b(\d{4})\b/)?.[1] ?? null;
}

/** Edit = re-confirm: the new wording supersedes the old row, and everything built on it follows. */
export async function editFact(userId: string, factId: string, text: string): Promise<Fact> {
  const content = clean(text);
  if (content.length < 1) throw new Error("A fact can't be empty. Delete it instead.");
  const facts = await listFacts(userId, { states: ["confirmed", "unconfirmed", "needs_review"] });
  const old = facts.find((f) => f.id === factId);
  if (!old) throw new Error("That fact isn't on your list anymore.");
  const field = fieldOf(old);
  const next = await reviseFact(userId, factId, { content: field === "bullet" ? bulletText(content) : content, data: old.data, source: "user_stated" });
  if (!next) throw new Error("That fact changed in another tab. Reload and try again.");

  if (field === "bullet" && old.experienceId) {
    const archived = await archiveBulletsCiting(userId, factId);
    const { score, checks } = scoreBullet(next.content);
    await db.insert(schema.bullet).values({
      userId,
      experienceId: old.experienceId,
      text: next.content,
      status: "active",
      favorite: archived.some((b) => b.favorite),
      factIds: [next.id],
      score,
      scoreDetail: { checks, verified: true, unsupported: [] },
      generator: "user",
      editedFromId: archived[0]?.id ?? null,
    });
  } else if (field && old.experienceId && (field === "org" || field === "title" || field === "location")) {
    await updateExperience(userId, old.experienceId, { [field]: next.content } as Partial<Pick<Experience, "org" | "title" | "location">>);
  } else if (field && PROFILE_FIELD[field]) {
    await syncProfileField(userId, field, next.content);
  } else {
    // A bullet written from this fact (older flows) no longer matches it.
    await archiveBulletsCiting(userId, factId);
  }
  return next;
}

export async function deleteFact(userId: string, factId: string) {
  const [fact] = await listFacts(userId, { states: ["confirmed", "unconfirmed", "needs_review"] }).then((rows) => rows.filter((f) => f.id === factId));
  if (!fact) return;
  const field = fieldOf(fact);
  if (fact.experienceId && field === "org") throw new Error("Delete the whole role instead; a role needs a name.");
  await rejectFact(userId, factId, "deleted on My facts");
  await archiveBulletsCiting(userId, factId);
  if (field && PROFILE_FIELD[field]) await syncProfileField(userId, field, null);
  if (fact.experienceId && (field === "title" || field === "location")) await updateExperience(userId, fact.experienceId, { [field]: null });
}

/** Removes a role or project with every fact and bullet attached to it. */
export async function deleteRole(userId: string, experienceId: string) {
  const facts = await listFacts(userId, { states: ["confirmed", "unconfirmed", "needs_review"], experienceId });
  for (const fact of facts) await rejectFact(userId, fact.id, "role deleted on My facts");
  await db.update(schema.bullet).set({ status: "archived" }).where(and(eq(schema.bullet.userId, userId), eq(schema.bullet.experienceId, experienceId)));
  await archiveExperience(userId, experienceId);
}

// ─── Reading ──────────────────────────────────────────────────────────────────

/**
 * Accounts from before the fact base kept education and role names only on the
 * profile and experience rows. The user typed those values, so record them as
 * facts once; nothing is created that the user didn't enter. Roles only count
 * if the user already confirmed something about them.
 */
export async function ensureFactBase(userId: string) {
  const [profile, experiences, facts] = await Promise.all([getProfile(userId), listExperiences(userId), listFacts(userId, { states: ["confirmed"] })]);
  const education = facts.filter((f) => f.category === "education");
  const base = { category: "education" as const, sourceDetail: "profile" };
  if (profile) {
    const want: Array<[EducationField, string]> = [
      ["school", profile.school ?? ""],
      ["degree", profile.degree ?? ""],
      ["major", profile.major ?? ""],
      ["grad_date", profile.gradDate ? formatMonth(profile.gradDate) : ""],
      ["gpa", profile.gpa != null ? String(profile.gpa) : ""],
    ];
    for (const [field, value] of want) {
      if (value && !education.some((f) => fieldOf(f) === field)) await setFieldFact(userId, education, field, value, base);
    }
  }
  for (const experience of experiences) {
    const own = facts.filter((f) => f.experienceId === experience.id);
    if (!own.length || own.some((f) => fieldOf(f) === "org")) continue;
    const roleBase = { category: (PROJECT_KINDS.includes(experience.kind) ? "project" : "experience") as FactCategory, experienceId: experience.id, sourceDetail: "experience record" };
    await setFieldFact(userId, own, "org", experience.org, roleBase);
    if (experience.title) await setFieldFact(userId, own, "title", experience.title, roleBase);
    if (experience.location) await setFieldFact(userId, own, "location", experience.location, roleBase);
    if (experience.startDate || experience.endDate) await setFieldFact(userId, own, "dates", datesText(experience.startDate, experience.endDate), roleBase);
  }
}

export type FactRow = { id: string; text: string; field: FactField | null; label: string; verifiedAt: Date | null; source: string };
export type RoleBlock = { experience: Experience; group: "experience" | "project"; header: FactRow[]; bullets: FactRow[] };
export type FactBase = {
  education: FactRow[];
  roles: RoleBlock[];
  skill: FactRow[];
  license: FactRow[];
  number: FactRow[];
  /** Older facts not tied to a role, kept visible so nothing is hidden from the user. */
  other: FactRow[];
  total: number;
};

const ROLE_ORDER: RoleField[] = ["title", "org", "dates", "location"];

export async function loadFactBase(userId: string): Promise<FactBase> {
  const [experiences, facts] = await Promise.all([listExperiences(userId), listFacts(userId, { states: ["confirmed"] })]);
  const row = (f: Fact): FactRow => {
    const field = fieldOf(f);
    return { id: f.id, text: f.content, field, label: field && field !== "item" ? FIELD_LABEL[field] : "", verifiedAt: f.confirmedAt, source: f.source };
  };
  const byExperience = new Map<string, Fact[]>();
  for (const f of facts) if (f.experienceId) byExperience.set(f.experienceId, [...(byExperience.get(f.experienceId) ?? []), f]);
  const roles: RoleBlock[] = experiences
    .filter((e) => byExperience.has(e.id))
    .map((experience) => {
      const own = byExperience.get(experience.id)!;
      const header = own.filter((f) => ROLE_ORDER.includes(fieldOf(f) as RoleField)).sort((a, b) => ROLE_ORDER.indexOf(fieldOf(a) as RoleField) - ROLE_ORDER.indexOf(fieldOf(b) as RoleField));
      const bullets = own.filter((f) => !ROLE_ORDER.includes(fieldOf(f) as RoleField));
      return { experience, group: groupOf(own[0], experience.kind) === "project" ? ("project" as const) : ("experience" as const), header: header.map(row), bullets: bullets.map(row) };
    });
  const loose = facts.filter((f) => !f.experienceId || !experiences.some((e) => e.id === f.experienceId));
  const eduOrder: EducationField[] = ["school", "degree", "major", "grad_date", "gpa", "detail"];
  return {
    education: loose.filter((f) => groupOf(f) === "education").sort((a, b) => eduOrder.indexOf(fieldOf(a) as EducationField) - eduOrder.indexOf(fieldOf(b) as EducationField)).map(row),
    roles,
    skill: loose.filter((f) => groupOf(f) === "skill").map(row),
    license: loose.filter((f) => groupOf(f) === "license").map(row),
    number: loose.filter((f) => groupOf(f) === "number").map(row),
    other: loose.filter((f) => ["experience", "project"].includes(groupOf(f))).map(row),
    total: facts.length,
  };
}

/** Confirmed fact texts, the input the linter and the model review check claims against. */
export async function confirmedFactTexts(userId: string): Promise<string[]> {
  return (await listFacts(userId, { states: ["confirmed"] })).map((f) => f.content);
}

/** Minimum needed to score a job: education and one role with at least one fact. */
export async function scoringReady(userId: string) {
  const [profile, experiences, facts] = await Promise.all([
    getProfile(userId),
    db.query.experience.findMany({ where: and(eq(schema.experience.userId, userId), isNull(schema.experience.archivedAt)) }),
    listFacts(userId, { states: ["confirmed"] }),
  ]);
  const hasEducation = Boolean(profile?.school) || facts.some((f) => f.category === "education" && fieldOf(f) === "school");
  const hasRole = experiences.some((e) => e.kind !== "education" && facts.some((f) => f.experienceId === e.id));
  return { hasEducation, hasRole, ready: hasEducation && hasRole };
}
