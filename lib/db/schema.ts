import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ─── Auth (Better Auth core schema) ───────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ─── Profile and preferences ──────────────────────────────────────────────────

export const workModeEnum = pgEnum("work_mode", ["remote", "hybrid", "onsite"]);

export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  phone: text("phone"),
  city: text("city"),
  region: text("region"),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  school: text("school"),
  degree: text("degree"),
  major: text("major"),
  minor: text("minor"),
  /** YYYY-MM */
  gradDate: text("grad_date"),
  gpa: doublePrecision("gpa"),
  targetRoles: text("target_roles").array().notNull().default(sql`'{}'::text[]`),
  targetLocations: text("target_locations").array().notNull().default(sql`'{}'::text[]`),
  workModes: workModeEnum("work_modes").array().notNull().default(sql`'{}'::work_mode[]`),
  industries: text("industries").array().notNull().default(sql`'{}'::text[]`),
  dealBreakers: text("deal_breakers").array().notNull().default(sql`'{}'::text[]`),
  /** Hourly for internships, yearly for full-time. */
  payFloor: integer("pay_floor"),
  /** e.g. "us_citizen", "permanent_resident", "needs_sponsorship" */
  workAuthorization: text("work_authorization"),
  /** Which term the user is recruiting for, e.g. "Summer 2027". */
  targetTerm: text("target_term"),
  onboardingStep: text("onboarding_step"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  /** Basics read from the last uploaded resume. Proposals that prefill the form; the profile fields above are what the student confirmed. */
  importedBasics: jsonb("imported_basics").$type<Record<string, string>>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Knowledge base ───────────────────────────────────────────────────────────

export const experienceKindEnum = pgEnum("experience_kind", [
  "work",
  "internship",
  "leadership",
  "project",
  "volunteer",
  "research",
  "education",
]);

export const experience = pgTable(
  "experience",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: experienceKindEnum("kind").notNull(),
    org: text("org").notNull(),
    title: text("title"),
    location: text("location"),
    /** YYYY-MM */
    startDate: text("start_date"),
    /** YYYY-MM, null while current */
    endDate: text("end_date"),
    /** What the user said about it, in their own words. Source material, never shown on a resume as-is. */
    rawNotes: text("raw_notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("experience_user_idx").on(t.userId)],
);

export const factCategoryEnum = pgEnum("fact_category", [
  "experience",
  "metric",
  "skill",
  "tool",
  "education",
  "certification",
  "award",
  "leadership",
  "project",
  "preference",
  "contact",
  "other",
]);

export const factSourceEnum = pgEnum("fact_source", [
  "user_stated",
  "resume_parsed",
  "inferred",
  "agent_proposed",
  "connector",
]);

export const verificationStateEnum = pgEnum("verification_state", [
  "confirmed",
  "unconfirmed",
  "needs_review",
  "rejected",
]);

/**
 * Append-only fact store. Facts are never updated in place or deleted: a change
 * inserts a new row that `supersedes` the old one, and the old row gets `supersededAt`.
 * A fact the user says is wrong moves to `rejected`, so the agent never proposes it again.
 */
export const fact = pgTable(
  "fact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    experienceId: uuid("experience_id").references(() => experience.id, { onDelete: "set null" }),
    category: factCategoryEnum("category").notNull(),
    content: text("content").notNull(),
    /** Structured form, e.g. { value: 40, unit: "accounts", period: "month" }. */
    data: jsonb("data").$type<Record<string, unknown>>(),
    source: factSourceEnum("source").notNull(),
    /** Where it came from: a file name, a question id, a connector name. */
    sourceDetail: text("source_detail"),
    verificationState: verificationStateEnum("verification_state").notNull().default("unconfirmed"),
    supersedesId: uuid("supersedes_id"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("fact_user_idx").on(t.userId),
    index("fact_experience_idx").on(t.experienceId),
    index("fact_current_idx").on(t.userId, t.verificationState).where(sql`superseded_at is null`),
  ],
);

export const bulletStatusEnum = pgEnum("bullet_status", ["draft", "active", "archived"]);

export const bullet = pgTable(
  "bullet",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    experienceId: uuid("experience_id")
      .notNull()
      .references(() => experience.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    status: bulletStatusEnum("status").notNull().default("draft"),
    favorite: boolean("favorite").notNull().default(false),
    /** Facts this bullet is built from. Every claim must trace to one. */
    factIds: uuid("fact_ids").array().notNull().default(sql`'{}'::uuid[]`),
    score: integer("score"),
    scoreDetail: jsonb("score_detail").$type<Record<string, unknown>>(),
    /** "offline", "anthropic", "user", "connector" */
    generator: text("generator").notNull(),
    promptVersion: text("prompt_version"),
    /** Set when the user edited a generated bullet; the pair becomes a voice sample. */
    editedFromId: uuid("edited_from_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("bullet_user_idx").on(t.userId), index("bullet_experience_idx").on(t.experienceId)],
);

export const questionKindEnum = pgEnum("question_kind", ["yes_no", "number", "text", "choice"]);
export const questionStatusEnum = pgEnum("question_status", ["open", "answered", "dismissed"]);

/** Things the agent wants to know. Asked one at a time, at the moment they matter. */
export const question = pgTable(
  "question",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    experienceId: uuid("experience_id").references(() => experience.id, { onDelete: "cascade" }),
    factId: uuid("fact_id").references(() => fact.id, { onDelete: "cascade" }),
    bulletId: uuid("bullet_id").references(() => bullet.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    kind: questionKindEnum("kind").notNull(),
    /** The value the agent would use if the user says yes. */
    proposedValue: text("proposed_value"),
    /** How an answer becomes a fact, e.g. "Reconciled {answer} vendor accounts a month". */
    factTemplate: text("fact_template"),
    factCategory: factCategoryEnum("fact_category"),
    choices: text("choices").array(),
    status: questionStatusEnum("status").notNull().default("open"),
    answer: text("answer"),
    priority: integer("priority").notNull().default(0),
    createdAt: createdAt(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (t) => [index("question_user_status_idx").on(t.userId, t.status)],
);

/** Private, unstructured memories. They become resume evidence only after promotion to an experience. */
export const storyNote = pgTable(
  "story_note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    context: text("context"),
    when: text("when"),
    promotedExperienceId: uuid("promoted_experience_id").references(() => experience.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("story_note_user_idx").on(t.userId, t.createdAt)],
);
// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const jobSourceEnum = pgEnum("job_source", [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "link",
  "workday",
  "themuse",
  "adzuna",
  "usajobs",
]);

/** internship, entry (new grad, junior), experienced, or unknown when the posting doesn't say. */
export const jobLevelEnum = pgEnum("job_level", ["internship", "entry", "experienced", "unknown"]);
export const jobModeEnum = pgEnum("job_mode", ["remote", "hybrid", "onsite", "unknown"]);

/** Postings are shared across users; per-user state lives in `job_match`. */
export const job = pgTable(
  "job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: jobSourceEnum("source").notNull(),
    sourceId: text("source_id").notNull(),
    company: text("company").notNull(),
    companySlug: text("company_slug").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    mode: jobModeEnum("mode").notNull().default("unknown"),
    level: jobLevelEnum("level").notNull().default("unknown"),
    url: text("url").notNull(),
    description: text("description"),
    department: text("department"),
    employmentType: text("employment_type"),
    payMin: doublePrecision("pay_min"),
    payMax: doublePrecision("pay_max"),
    payPeriod: text("pay_period"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    /** Same role on several boards collapses to one dedupe key. */
    dedupeKey: text("dedupe_key").notNull(),
    /** Parsed requirements, cached so every user reuses the work. */
    requirements: jsonb("requirements").$type<Record<string, unknown>>(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("job_source_uidx").on(t.source, t.sourceId),
    index("job_dedupe_idx").on(t.dedupeKey),
    index("job_company_idx").on(t.companySlug),
  ],
);

export const matchStatusEnum = pgEnum("match_status", ["new", "saved", "dismissed"]);

export const jobMatch = pgTable(
  "job_match",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    status: matchStatusEnum("status").notNull().default("new"),
    fitScore: integer("fit_score"),
    fit: jsonb("fit").$type<Record<string, unknown>>(),
    dismissReason: text("dismiss_reason"),
    savedSearchId: uuid("saved_search_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("job_match_user_job_uidx").on(t.userId, t.jobId), index("job_match_user_idx").on(t.userId, t.status)],
);

export const savedSearch = pgTable(
  "saved_search",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    intent: jsonb("intent").$type<Record<string, unknown>>().notNull(),
    alerts: boolean("alerts").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("saved_search_user_idx").on(t.userId)],
);

// ─── Resumes and applications ─────────────────────────────────────────────────

export const resume = pgTable(
  "resume",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null for the base resume. */
    jobId: uuid("job_id").references(() => job.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    template: text("template").notNull(),
    variant: text("variant").notNull(),
    /** Snapshot of exactly what's on the page, so a sent resume never changes after the fact. */
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    why: jsonb("why").$type<Record<string, unknown>>(),
    cuts: jsonb("cuts").$type<Record<string, unknown>>(),
    checks: jsonb("checks").$type<Record<string, unknown>>(),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index("resume_user_idx").on(t.userId)],
);

export const applicationStageEnum = pgEnum("application_stage", [
  "saved",
  "applied",
  "assessment",
  "interview",
  "offer",
  "rejected",
]);

export const application = pgTable(
  "application",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => job.id, { onDelete: "set null" }),
    company: text("company").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    stage: applicationStageEnum("stage").notNull().default("saved"),
    resumeId: uuid("resume_id").references(() => resume.id, { onDelete: "set null" }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    deadline: text("deadline"),
    notes: text("notes"),
    contacts: jsonb("contacts").$type<Array<{ name: string; role?: string; email?: string }>>(),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("application_user_idx").on(t.userId, t.stage)],
);

/**
 * Everything prepared for one job beyond the resume: the cover letter, the
 * person's own reason for applying, and their interview practice notes.
 */
export const applicationPacket = pgTable(
  "application_packet",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    /** The person's reason for wanting this job, in their words. Never generated. */
    why: text("why"),
    /** CoverLetter from lib/packet/cover-letter.ts. */
    coverLetter: jsonb("cover_letter").$type<Record<string, unknown>>(),
    coverLetterAt: timestamp("cover_letter_at", { withTimezone: true }),
    /** Practice answers by question id. */
    interviewNotes: jsonb("interview_notes").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    /** Drafts for the application form's own questions (ApplicationAnswer[] from lib/packet/answers.ts). */
    answers: jsonb("answers").$type<Array<Record<string, unknown>>>().notNull().default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("application_packet_user_job_uidx").on(t.userId, t.jobId)],
);

// ─── Agent memory ─────────────────────────────────────────────────────────────

/**
 * Everything the agent learns from: confirmations, rejections, edits, saves,
 * dismissals, outcomes. Append-only; learners read it, nothing rewrites it.
 */
export const agentEvent = pgTable(
  "agent_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("agent_event_user_type_idx").on(t.userId, t.type)],
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: jsonb("content").$type<unknown>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chat_message_user_idx").on(t.userId, t.createdAt)],
);

/** Personal access tokens for connecting an outside AI (Claude, ChatGPT, Gemini) over MCP. */
export const apiToken = pgTable(
  "api_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    /** First characters, shown in settings so users can tell tokens apart. */
    prefix: text("prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("api_token_user_idx").on(t.userId)],
);
