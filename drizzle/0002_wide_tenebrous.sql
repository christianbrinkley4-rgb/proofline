CREATE TABLE "story_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"context" text,
	"when" text,
	"promoted_experience_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_note" ADD CONSTRAINT "story_note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_note" ADD CONSTRAINT "story_note_promoted_experience_id_experience_id_fk" FOREIGN KEY ("promoted_experience_id") REFERENCES "public"."experience"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_note_user_idx" ON "story_note" USING btree ("user_id","created_at");