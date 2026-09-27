CREATE TYPE "public"."bullet_suggestion_kind" AS ENUM('reframe', 'likely_task', 'skill_angle');--> statement-breakpoint
CREATE TYPE "public"."bullet_suggestion_reason" AS ENUM('not_true', 'true_but_weak', 'wording');--> statement-breakpoint
CREATE TYPE "public"."bullet_suggestion_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "bullet_suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"experience_id" uuid NOT NULL,
	"text" text NOT NULL,
	"task_id" text,
	"kind" "bullet_suggestion_kind" NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_fact_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"slot" text,
	"status" "bullet_suggestion_status" DEFAULT 'pending' NOT NULL,
	"reason" "bullet_suggestion_reason",
	"batch" integer NOT NULL,
	"generator" text NOT NULL,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bullet_suggestion" ADD CONSTRAINT "bullet_suggestion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bullet_suggestion" ADD CONSTRAINT "bullet_suggestion_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bullet_suggestion_experience_status_idx" ON "bullet_suggestion" USING btree ("user_id","experience_id","status");