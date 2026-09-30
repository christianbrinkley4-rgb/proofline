ALTER TABLE "job" ADD COLUMN "listed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "screens" jsonb;--> statement-breakpoint
CREATE INDEX "job_listed_idx" ON "job" USING btree ("listed_at");--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "feed_filters" jsonb;
