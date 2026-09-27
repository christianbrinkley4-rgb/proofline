CREATE TABLE "career_checkin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" uuid NOT NULL,
	"confirmed_facts" integer NOT NULL,
	"active_bullets" integer NOT NULL,
	"relevant_bullets" integer NOT NULL,
	"matched_required" integer,
	"total_required" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"target_role" text NOT NULL,
	"target_month" text,
	"motivation" text,
	"benchmark_job_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "career_checkin" ADD CONSTRAINT "career_checkin_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_checkin" ADD CONSTRAINT "career_checkin_goal_id_career_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."career_goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_goal" ADD CONSTRAINT "career_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_goal" ADD CONSTRAINT "career_goal_benchmark_job_id_job_id_fk" FOREIGN KEY ("benchmark_job_id") REFERENCES "public"."job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_checkin_goal_idx" ON "career_checkin" USING btree ("goal_id","created_at");--> statement-breakpoint
CREATE INDEX "career_goal_user_idx" ON "career_goal" USING btree ("user_id","status");