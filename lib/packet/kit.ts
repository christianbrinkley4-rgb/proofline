import { createHash } from "node:crypto";
import type { EducationRecord } from "@/lib/facts/base";
import { extractSkills } from "@/lib/fit/skills";
import { formatMonth } from "@/lib/resume/parse/dates";
import { verifyBullet } from "@/lib/resume/verify";
import { PLACEHOLDER } from "./answers";

/**
 * The answer kit: every common application field, filled only from what the
 * person confirmed. A field with nothing behind it stays blank and says what's
 * missing. Proofline copies nothing into a form and submits nothing; the kit is
 * a page the person works from, and "Mark submitted" keeps an exact copy.
 */

export const KIT_VERSION = 1;

export type KitSource =
  | { kind: "fact"; id: string; text: string }
  | { kind: "profile"; label: string }
  | { kind: "yours"; label: string };

export type KitBlank = {
  /** no_fact: nothing confirmed to fill it. not_built: the document isn't ready. changed: its fact changed since it was drafted. */
  kind: "no_fact" | "not_built" | "changed";
  reason: string;
  fix: { label: string; href: string };
};

export type KitField = {
  key: string;
  label: string;
  /** Exactly what the person would paste. Empty when blank. */
  value: string;
  sources: KitSource[];
  blank?: KitBlank;
  multiline?: boolean;
  /** Set when the value still has a bracketed part only the person can write. Copy waits for it. */
  unfinished?: string;
  /** A document to attach instead of text. */
  file?: { name: string; href: string };
};

export type KitEntry = { key: string; heading?: string; fields: KitField[] };
export type KitGroup = { key: string; title: string; note?: string; entries: KitEntry[] };

export type AnswerKit = {
  version: typeof KIT_VERSION;
  jobId: string;
  company: string;
  title: string;
  groups: KitGroup[];
  /** Fields left blank because no confirmed fact supports them. */
  blankCount: number;
  /** Hash of every value and source, so a record can prove it matches what the person saw. */
  digest: string;
};

/** Questions Proofline never answers, whatever the facts say. */
export const ANSWER_YOURSELF: Array<{ label: string; why: string }> = [
  { label: "Voluntary self-identification (gender, race and ethnicity, veteran status, disability)", why: "These are yours to answer or decline. Proofline never fills them." },
  { label: "Desired pay", why: "Say what you'd accept for this role. Proofline doesn't guess a number for you." },
  { label: "How did you hear about this job?", why: "Only you know." },
  { label: "Anything you agree to or sign", why: "Read it yourself before you check the box." },
];

export type KitRole = {
  experienceId: string;
  org: { text: string; factId: string | null };
  title: { text: string; factId: string } | null;
  location: { text: string; factId: string } | null;
  /** From the role's confirmed dates fact. */
  dates: { start: string | null; end: string | null; factId: string } | null;
  /** Lines to describe the role, each with the confirmed facts it rests on. */
  lines: Array<{ text: string; factIds: string[] }>;
};

export type KitInput = {
  job: { id: string; company: string; title: string; asksCitizenship: boolean };
  profile: {
    fullName: string | null;
    contactEmail: string | null;
    phone: string | null;
    city: string | null;
    region: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
    workAuthorization: string | null;
    availableFrom: string | null;
    openToRelocate: boolean | null;
  } | null;
  education: EducationRecord[];
  roles: KitRole[];
  skills: Array<{ id: string; text: string }>;
  licenses: Array<{ id: string; text: string }>;
  resume: { id: string; fileName: string; label: string } | null;
  letter: { text: string; factIds: string[]; usesOwnWords: boolean; status: "none" | "needs_you" | "ready"; blocked: boolean } | null;
  answers: Array<{ id: string; question: string; answer: string; factIds: string[]; sourcesChanged: boolean; ownWords: boolean }>;
  factText: Map<string, string>;
};

const CONTACT_FIX = { label: "Edit contact details", href: "/app/facts" };
const EDUCATION_FIX = { label: "Add it on My facts", href: "/app/facts" };
const ROLE_FIX = { label: "Add it on My facts", href: "/app/facts" };

const CONTACT = { kind: "profile", label: "Your contact details" } as const;
const YOUR_NAME = { kind: "profile", label: "Your name as saved" } as const;
const LOGISTICS = { kind: "profile", label: "Your answer in Settings" } as const;

function field(key: string, label: string, value: string | null | undefined, sources: KitSource[], blank: KitBlank): KitField {
  const text = (value ?? "").trim();
  return text ? { key, label, value: text, sources } : { key, label, value: "", sources: [], blank };
}

const noFact = (reason: string, fix: KitBlank["fix"]): KitBlank => ({ kind: "no_fact", reason, fix });

function factSource(id: string | null | undefined, facts: Map<string, string>): KitSource[] {
  if (!id) return [];
  const text = facts.get(id);
  return text ? [{ kind: "fact", id, text }] : [];
}

/** "Christian Brinkley" to first "Christian", last "Brinkley". Middle names stay with the last name; the person reviews it. */
export function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

const monthYear = (value: string | null | undefined) => (value ? formatMonth(value) : "");

function contactGroup(input: KitInput): KitGroup {
  const p = input.profile;
  const name = splitName(p?.fullName);
  const nameBlank = noFact("No name saved yet.", CONTACT_FIX);
  const place = [p?.city, p?.region].filter(Boolean).join(", ");
  return {
    key: "contact",
    title: "Contact",
    entries: [{
      key: "contact",
      fields: [
        field("contact.first", "First name", name.first, [YOUR_NAME], nameBlank),
        field("contact.last", "Last name", name.last, [YOUR_NAME], noFact("Your saved name has one word. Type your last name on the form.", CONTACT_FIX)),
        field("contact.email", "Email", p?.contactEmail, [CONTACT], noFact("No resume email saved. Your sign-in address isn't used unless you add it.", CONTACT_FIX)),
        field("contact.phone", "Phone", p?.phone, [CONTACT], noFact("No phone number saved.", CONTACT_FIX)),
        field("contact.location", "Location", place, [CONTACT], noFact("No city saved.", CONTACT_FIX)),
        field("contact.linkedin", "LinkedIn", p?.linkedinUrl, [CONTACT], noFact("No LinkedIn link saved.", CONTACT_FIX)),
        field("contact.website", "Website", p?.portfolioUrl, [CONTACT], { kind: "no_fact", reason: "No website saved. Most forms don't require one.", fix: CONTACT_FIX }),
      ],
    }],
  };
}

function documentsGroup(input: KitInput, facts: Map<string, string>): KitGroup {
  const { job, resume, letter } = input;
  const tailor = { label: "Build your resume", href: `/app/jobs/${job.id}?tab=tailor` };
  const packet = { label: "Open the cover letter", href: `/app/jobs/${job.id}/packet#letter` };
  const resumeField: KitField = resume
    ? { key: "documents.resume", label: "Resume", value: resume.fileName, sources: [{ kind: "profile", label: resume.label }], file: { name: resume.fileName, href: `/app/jobs/${job.id}?tab=tailor` } }
    : { key: "documents.resume", label: "Resume", value: "", sources: [], blank: { kind: "not_built", reason: "No resume built for this job yet.", fix: tailor } };

  let letterField: KitField;
  if (!letter || letter.status === "none") {
    letterField = { key: "documents.letter", label: "Cover letter", value: "", sources: [], multiline: true, blank: { kind: "not_built", reason: "Not drafted yet. Many forms make it optional.", fix: { ...packet, label: "Draft the cover letter" } } };
  } else if (letter.blocked) {
    letterField = { key: "documents.letter", label: "Cover letter", value: "", sources: [], multiline: true, blank: { kind: "changed", reason: "A claim in the letter no longer matches your confirmed facts. Fix it before you send it.", fix: packet } };
  } else {
    const sources: KitSource[] = [...new Set(letter.factIds)].flatMap((id) => factSource(id, facts));
    if (letter.usesOwnWords) sources.push({ kind: "yours", label: "Your reason for applying, in your words" });
    letterField = {
      key: "documents.letter",
      label: "Cover letter",
      value: letter.text,
      sources,
      multiline: true,
      unfinished: letter.status === "needs_you" ? "Write the bracketed part in your own words on the packet page first." : undefined,
    };
  }
  return { key: "documents", title: "Documents", entries: [{ key: "documents", fields: [resumeField, letterField] }] };
}

function educationGroup(input: KitInput, facts: Map<string, string>): KitGroup {
  const records = input.education.filter((r) => r.school.trim());
  if (!records.length) {
    return {
      key: "education",
      title: "Education",
      entries: [{ key: "education.none", fields: [field("education.none.school", "School", "", [], noFact("No school confirmed yet.", EDUCATION_FIX))] }],
    };
  }
  return {
    key: "education",
    title: "Education",
    entries: records.map((r) => {
      const k = `education.${r.id}`;
      const fields: KitField[] = [
        field(`${k}.school`, "School", r.school, factSource(r.factIds.school, facts), noFact("No school saved.", EDUCATION_FIX)),
        field(`${k}.degree`, "Degree", r.degree, factSource(r.factIds.degree, facts), noFact("No degree saved for this school.", EDUCATION_FIX)),
        field(`${k}.major`, "Major or discipline", r.major, factSource(r.factIds.major, facts), noFact("No major saved for this school.", EDUCATION_FIX)),
        field(`${k}.grad`, "Graduation date", r.gradMonth ? monthYear(r.gradMonth) : r.gradDate, factSource(r.factIds.grad, facts), noFact("No graduation date saved.", EDUCATION_FIX)),
        field(`${k}.gpa`, "GPA", r.gpa, factSource(r.factIds.gpa, facts), noFact("No GPA saved. Leave it blank if the form allows, or add it on My facts.", EDUCATION_FIX)),
      ];
      if (r.honors.trim()) fields.push({ key: `${k}.honors`, label: "Honors", value: r.honors.trim(), sources: r.factIds.honors.flatMap((id) => factSource(id, facts)) });
      if (r.coursework.trim()) fields.push({ key: `${k}.coursework`, label: "Coursework", value: r.coursework.replace(/^(relevant\s+)?coursework\s*:\s*/i, "").trim(), sources: factSource(r.factIds.coursework, facts) });
      return { key: k, heading: r.school, fields };
    }),
  };
}

function workGroup(input: KitInput, facts: Map<string, string>): KitGroup {
  if (!input.roles.length) {
    return {
      key: "work",
      title: "Work history",
      entries: [{ key: "work.none", fields: [field("work.none.org", "Employer", "", [], noFact("No role confirmed yet.", ROLE_FIX))] }],
    };
  }
  return {
    key: "work",
    title: "Work history",
    note: "Newest first. The description uses the lines on your resume for this job when it has them.",
    entries: input.roles.map((role) => {
      const k = `work.${role.experienceId}`;
      const dateSource = role.dates ? factSource(role.dates.factId, facts) : [];
      const start = role.dates?.start ? monthYear(role.dates.start) : "";
      const end = role.dates ? (role.dates.end ? monthYear(role.dates.end) : role.dates.start ? "Present (I currently work here)" : "") : "";
      const lines = role.lines.filter((l) => l.factIds.length && l.factIds.every((id) => facts.has(id)) && verifyBullet(l.text, l.factIds.map((id) => facts.get(id)!)).ok);
      const fields: KitField[] = [
        field(`${k}.org`, "Employer", role.org.text, factSource(role.org.factId, facts), noFact("No employer saved.", ROLE_FIX)),
        field(`${k}.title`, "Title", role.title?.text, factSource(role.title?.factId, facts), noFact("No title saved for this role.", ROLE_FIX)),
        field(`${k}.start`, "Start date", start, dateSource, noFact("No start date saved for this role.", ROLE_FIX)),
        field(`${k}.end`, "End date", end, dateSource, noFact("No end date saved for this role.", ROLE_FIX)),
      ];
      if (role.location) fields.push({ key: `${k}.location`, label: "Location", value: role.location.text, sources: factSource(role.location.factId, facts) });
      const lineSources = [...new Set(lines.flatMap((l) => l.factIds))].flatMap((id) => factSource(id, facts));
      fields.push({ ...field(`${k}.description`, "Description", lines.map((l) => `• ${l.text}`).join("\n"), lineSources, noFact("No confirmed lines for this role yet.", ROLE_FIX)), multiline: true });
      return { key: k, heading: [role.title?.text, role.org.text].filter(Boolean).join(", "), fields };
    }),
  };
}

function skillsGroup(input: KitInput): KitGroup {
  const fields: KitField[] = [
    field("skills.list", "Skills", input.skills.map((s) => s.text).join(", "), input.skills.map((s) => ({ kind: "fact", id: s.id, text: s.text })), noFact("No skills confirmed yet.", ROLE_FIX)),
  ];
  if (input.licenses.length) {
    fields.push({ key: "skills.licenses", label: "Licenses and certifications", value: input.licenses.map((s) => s.text).join(", "), sources: input.licenses.map((s) => ({ kind: "fact", id: s.id, text: s.text })) });
  }
  return { key: "skills", title: "Skills", entries: [{ key: "skills", fields }] };
}

const AUTHORIZED = new Set(["us_citizen", "permanent_resident", "authorized"]);

function eligibilityGroup(input: KitInput): KitGroup {
  const p = input.profile;
  const fix = { label: "Answer it in Settings", href: `/app/onboarding?step=logistics&back=/app/jobs/${input.job.id}/kit` };
  const auth = p?.workAuthorization ?? null;
  const authorizedNow = auth && AUTHORIZED.has(auth) ? "Yes" : "";
  const sponsorship = auth ? (auth === "needs_sponsorship" ? "Yes" : "No") : "";
  const fields: KitField[] = [
    field("eligibility.authorized", "Are you legally authorized to work in the U.S.?", authorizedNow, [LOGISTICS],
      auth === "needs_sponsorship"
        ? noFact("You said you'll need sponsorship, but not whether you can work in the U.S. today. Answer this one yourself.", fix)
        : noFact("You haven't told Proofline your work authorization.", fix)),
    field("eligibility.sponsorship", "Will you now or in the future need visa sponsorship?", sponsorship, [LOGISTICS], noFact("You haven't told Proofline your work authorization.", fix)),
  ];
  if (input.job.asksCitizenship) {
    fields.push(field("eligibility.citizen", "Are you a U.S. citizen?", auth ? (auth === "us_citizen" ? "Yes" : "No") : "", [LOGISTICS], noFact("This posting asks about citizenship, and you haven't told Proofline your work authorization.", fix)));
  }
  fields.push(
    field("eligibility.start", "Earliest start date", monthYear(p?.availableFrom), [LOGISTICS], noFact("No earliest start date saved.", fix)),
    field("eligibility.relocate", "Are you willing to relocate?", p?.openToRelocate == null ? "" : p.openToRelocate ? "Yes" : "No", [LOGISTICS], noFact("You haven't said whether you'd move for a job.", fix)),
  );
  return { key: "eligibility", title: "Eligibility", note: "Taken from your answers about work authorization, start date, and moving.", entries: [{ key: "eligibility", fields }] };
}

/** What a person could confirm so Proofline can help with a question next time. */
export function suggestFact(question: string): string {
  const skills = [...new Set(extractSkills(question))];
  if (skills.length) return `You could add a fact about where you've used ${skills.slice(0, 2).join(" or ")}.`;
  if (/\b(time|situation|example|challenge|conflict|mistake|failure)\b/i.test(question)) return "You could add a fact about the example this question asks for: what you did and what came of it.";
  return "You could add a fact about what this question asks, in your own words.";
}

function questionsGroup(input: KitInput, facts: Map<string, string>): KitGroup {
  const fix = { label: "Redraft it on the packet page", href: `/app/jobs/${input.job.id}/packet#questions` };
  return {
    key: "questions",
    title: "Questions from the form",
    note: input.answers.length ? "Drafted from your confirmed facts. Each one names the facts it used." : "Paste a question from the application below and Proofline drafts an answer from your confirmed facts.",
    entries: input.answers.map((a) => {
      const k = `questions.${a.id}`;
      if (a.sourcesChanged) {
        return { key: k, fields: [{ key: k, label: a.question, value: "", sources: [], multiline: true, blank: { kind: "changed", reason: "A fact this answer used changed or was removed, so it's held back.", fix } }] };
      }
      const sources: KitSource[] = a.factIds.flatMap((id) => factSource(id, facts));
      if (a.ownWords) sources.push({ kind: "yours", label: "Your own words" });
      const unfinished = PLACEHOLDER.test(a.answer);
      const noEvidence = !a.factIds.length && !a.ownWords;
      return {
        key: k,
        fields: [{
          key: k,
          label: a.question,
          value: noEvidence && unfinished ? "" : a.answer.trim(),
          sources,
          multiline: true,
          ...(noEvidence && unfinished
            ? { blank: { kind: "no_fact" as const, reason: `None of your confirmed facts answer this. ${suggestFact(a.question)}`, fix: { label: "Add a fact", href: "/app/facts" } } }
            : unfinished ? { unfinished: "Fill in the bracketed parts in your own words on the packet page." } : {}),
        }],
      };
    }),
  };
}

export function kitDigest(groups: KitGroup[]): string {
  const shape = groups.map((g) => g.entries.map((e) => e.fields.map((f) => [f.key, f.value, f.sources.map((s) => (s.kind === "fact" ? s.id : s.label)), f.blank?.kind ?? null, Boolean(f.unfinished)])));
  return createHash("sha256").update(JSON.stringify(shape)).digest("hex").slice(0, 32);
}

export function buildAnswerKit(input: KitInput): AnswerKit {
  const facts = input.factText;
  const groups = [
    contactGroup(input),
    documentsGroup(input, facts),
    educationGroup(input, facts),
    workGroup(input, facts),
    skillsGroup(input),
    eligibilityGroup(input),
    questionsGroup(input, facts),
  ];
  const blankCount = groups.flatMap((g) => g.entries.flatMap((e) => e.fields)).filter((f) => f.blank?.kind === "no_fact").length;
  return { version: KIT_VERSION, jobId: input.job.id, company: input.job.company, title: input.job.title, groups, blankCount, digest: kitDigest(groups) };
}

export function kitFields(kit: Pick<AnswerKit, "groups">): KitField[] {
  return kit.groups.flatMap((g) => g.entries.flatMap((e) => e.fields));
}
