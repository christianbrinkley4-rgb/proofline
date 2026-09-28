CREATE TABLE "inbox_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"email" text,
	"name" text,
	"message" text NOT NULL,
	"page" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "follow_up_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "confirmation_ref" text;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "keywords" jsonb;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "available_from" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "open_to_relocate" boolean;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "review" jsonb;--> statement-breakpoint
ALTER TABLE "inbox_message" ADD CONSTRAINT "inbox_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbox_message_kind_idx" ON "inbox_message" USING btree ("kind","created_at");