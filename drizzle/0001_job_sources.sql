CREATE TYPE "public"."job_level" AS ENUM('internship', 'entry', 'experienced', 'unknown');--> statement-breakpoint
ALTER TYPE "public"."job_source" ADD VALUE 'workday';--> statement-breakpoint
ALTER TYPE "public"."job_source" ADD VALUE 'themuse';--> statement-breakpoint
ALTER TYPE "public"."job_source" ADD VALUE 'adzuna';--> statement-breakpoint
ALTER TYPE "public"."job_source" ADD VALUE 'usajobs';--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "level" "job_level" DEFAULT 'unknown' NOT NULL;