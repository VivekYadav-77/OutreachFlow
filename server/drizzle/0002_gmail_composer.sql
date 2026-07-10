CREATE TYPE "public"."email_draft_status" AS ENUM('Draft', 'Queued', 'Sending', 'Sent', 'Failed');--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'resume' NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cc" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bcc" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"html" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"status" "email_draft_status" DEFAULT 'Draft' NOT NULL,
	"last_error" text,
	"gmail_message_id" text,
	"queued_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_draft_attachments" (
	"draft_id" integer NOT NULL,
	"file_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_draft_attachments_draft_id_file_id_pk" PRIMARY KEY("draft_id","file_id")
);
--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN IF NOT EXISTS "draft_id" integer;--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "recruiter_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_draft_attachments" ADD CONSTRAINT "email_draft_attachments_draft_id_email_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."email_drafts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_draft_attachments" ADD CONSTRAINT "email_draft_attachments_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_draft_id_email_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."email_drafts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
