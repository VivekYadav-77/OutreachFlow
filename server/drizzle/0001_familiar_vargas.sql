CREATE TYPE "public"."campaign_recipient_status" AS ENUM('Pending', 'Queued', 'Sending', 'Sent', 'Failed', 'Skipped');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('Draft', 'Scheduled', 'Running', 'Paused', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."failure_type" AS ENUM('Temporary', 'Permanent');--> statement-breakpoint
CREATE TABLE "campaign_daily_stats" (
	"campaign_id" integer NOT NULL,
	"date" text NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"temporary_failure_count" integer DEFAULT 0 NOT NULL,
	"permanent_failure_count" integer DEFAULT 0 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"total_send_time_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_daily_stats_campaign_id_date_pk" PRIMARY KEY("campaign_id","date")
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"recruiter_id" integer NOT NULL,
	"status" "campaign_recipient_status" DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "campaign_status" DEFAULT 'Draft' NOT NULL,
	"template_id" integer,
	"resume_file_id" integer,
	"daily_limit" integer DEFAULT 50 NOT NULL,
	"min_delay_seconds" integer DEFAULT 45 NOT NULL,
	"max_delay_seconds" integer DEFAULT 150 NOT NULL,
	"start_time" text DEFAULT '09:00' NOT NULL,
	"end_time" text DEFAULT '18:00' NOT NULL,
	"retry_count" integer DEFAULT 4 NOT NULL,
	"retry_intervals_minutes" jsonb DEFAULT '[5,15,30,60]'::jsonb NOT NULL,
	"attachment_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "campaign_id" integer;--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "campaign_recipient_id" integer;--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "failure_type" "failure_type";--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "campaign_daily_stats" ADD CONSTRAINT "campaign_daily_stats_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_resume_file_id_uploaded_files_id_fk" FOREIGN KEY ("resume_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_recipients_campaign_recruiter_unique" ON "campaign_recipients" USING btree ("campaign_id","recruiter_id");--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_campaign_recipient_id_campaign_recipients_id_fk" FOREIGN KEY ("campaign_recipient_id") REFERENCES "public"."campaign_recipients"("id") ON DELETE cascade ON UPDATE no action;