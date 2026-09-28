CREATE TABLE "resume_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"resume_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "resume_share_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "resume_share" ADD CONSTRAINT "resume_share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_share" ADD CONSTRAINT "resume_share_resume_id_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_share_user_idx" ON "resume_share" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_share_resume_idx" ON "resume_share" USING btree ("resume_id");