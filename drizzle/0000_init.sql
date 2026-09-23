CREATE TYPE "public"."application_stage" AS ENUM('saved', 'applied', 'assessment', 'interview', 'offer', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."bullet_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."experience_kind" AS ENUM('work', 'internship', 'leadership', 'project', 'volunteer', 'research', 'education');--> statement-breakpoint
CREATE TYPE "public"."fact_category" AS ENUM('experience', 'metric', 'skill', 'tool', 'education', 'certification', 'award', 'leadership', 'project', 'preference', 'contact', 'other');--> statement-breakpoint
CREATE TYPE "public"."fact_source" AS ENUM('user_stated', 'resume_parsed', 'inferred', 'agent_proposed', 'connector');--> statement-breakpoint
CREATE TYPE "public"."job_mode" AS ENUM('remote', 'hybrid', 'onsite', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."job_source" AS ENUM('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'link');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('new', 'saved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."question_kind" AS ENUM('yes_no', 'number', 'text', 'choice');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('open', 'answered', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."verification_state" AS ENUM('confirmed', 'unconfirmed', 'needs_review', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."work_mode" AS ENUM('remote', 'hybrid', 'onsite');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"job_id" uuid,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"stage" "application_stage" DEFAULT 'saved' NOT NULL,
	"resume_id" uuid,
	"applied_at" timestamp with time zone,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_follow_up_at" timestamp with time zone,
	"deadline" text,
	"notes" text,
	"contacts" jsonb,
	"sort_order" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bullet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"experience_id" uuid NOT NULL,
	"text" text NOT NULL,
	"status" "bullet_status" DEFAULT 'draft' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"fact_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"score" integer,
	"score_detail" jsonb,
	"generator" text NOT NULL,
	"prompt_version" text,
	"edited_from_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "experience_kind" NOT NULL,
	"org" text NOT NULL,
	"title" text,
	"location" text,
	"start_date" text,
	"end_date" text,
	"raw_notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"experience_id" uuid,
	"category" "fact_category" NOT NULL,
	"content" text NOT NULL,
	"data" jsonb,
	"source" "fact_source" NOT NULL,
	"source_detail" text,
	"verification_state" "verification_state" DEFAULT 'unconfirmed' NOT NULL,
	"supersedes_id" uuid,
	"superseded_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "job_source" NOT NULL,
	"source_id" text NOT NULL,
	"company" text NOT NULL,
	"company_slug" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"mode" "job_mode" DEFAULT 'unknown' NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"department" text,
	"employment_type" text,
	"pay_min" double precision,
	"pay_max" double precision,
	"pay_period" text,
	"posted_at" timestamp with time zone,
	"dedupe_key" text NOT NULL,
	"requirements" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'new' NOT NULL,
	"fit_score" integer,
	"fit" jsonb,
	"dismiss_reason" text,
	"saved_search_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"full_name" text,
	"phone" text,
	"city" text,
	"region" text,
	"linkedin_url" text,
	"portfolio_url" text,
	"school" text,
	"degree" text,
	"major" text,
	"minor" text,
	"grad_date" text,
	"gpa" double precision,
	"target_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"target_locations" text[] DEFAULT '{}'::text[] NOT NULL,
	"work_modes" "work_mode"[] DEFAULT '{}'::work_mode[] NOT NULL,
	"industries" text[] DEFAULT '{}'::text[] NOT NULL,
	"deal_breakers" text[] DEFAULT '{}'::text[] NOT NULL,
	"pay_floor" integer,
	"work_authorization" text,
	"target_term" text,
	"onboarding_step" text,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"experience_id" uuid,
	"fact_id" uuid,
	"bullet_id" uuid,
	"prompt" text NOT NULL,
	"kind" "question_kind" NOT NULL,
	"proposed_value" text,
	"fact_template" text,
	"fact_category" "fact_category",
	"choices" text[],
	"status" "question_status" DEFAULT 'open' NOT NULL,
	"answer" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "resume" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"job_id" uuid,
	"name" text NOT NULL,
	"template" text NOT NULL,
	"variant" text NOT NULL,
	"content" jsonb NOT NULL,
	"why" jsonb,
	"cuts" jsonb,
	"checks" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_search" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"intent" jsonb NOT NULL,
	"alerts" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_event" ADD CONSTRAINT "agent_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_resume_id_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resume"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bullet" ADD CONSTRAINT "bullet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bullet" ADD CONSTRAINT "bullet_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience" ADD CONSTRAINT "experience_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_match" ADD CONSTRAINT "job_match_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_match" ADD CONSTRAINT "job_match_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_fact_id_fact_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."fact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_bullet_id_bullet_id_fk" FOREIGN KEY ("bullet_id") REFERENCES "public"."bullet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume" ADD CONSTRAINT "resume_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume" ADD CONSTRAINT "resume_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_event_user_type_idx" ON "agent_event" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "api_token_user_idx" ON "api_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "application_user_idx" ON "application" USING btree ("user_id","stage");--> statement-breakpoint
CREATE INDEX "bullet_user_idx" ON "bullet" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bullet_experience_idx" ON "bullet" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "chat_message_user_idx" ON "chat_message" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "experience_user_idx" ON "experience" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fact_user_idx" ON "fact" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fact_experience_idx" ON "fact" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "fact_current_idx" ON "fact" USING btree ("user_id","verification_state") WHERE superseded_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "job_source_uidx" ON "job" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "job_dedupe_idx" ON "job" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "job_company_idx" ON "job" USING btree ("company_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "job_match_user_job_uidx" ON "job_match" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "job_match_user_idx" ON "job_match" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "question_user_status_idx" ON "question" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "resume_user_idx" ON "resume" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_search_user_idx" ON "saved_search" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");