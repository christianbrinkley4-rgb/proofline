ALTER TABLE "profile" ADD COLUMN "auto_run" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "last_auto_run_at" timestamp with time zone;
