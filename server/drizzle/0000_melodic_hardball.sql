CREATE TYPE "public"."log_level" AS ENUM('info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."queue_state" AS ENUM('Pending', 'Sending', 'Sent', 'Failed', 'Retrying', 'Paused');--> statement-breakpoint
CREATE TYPE "public"."recruiter_status" AS ENUM('Pending', 'Sent', 'Failed', 'Replied', 'Skipped');--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"total_send_time_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"recruiter_id" integer NOT NULL,
	"template_id" integer,
	"state" "queue_state" DEFAULT 'Pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 4 NOT NULL,
	"last_error" text,
	"gmail_message_id" text,
	"next_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject_template" text NOT NULL,
	"html_template" text NOT NULL,
	"text_template" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'google' NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token" text,
	"expiry_date" timestamp with time zone,
	"scope" text,
	"token_type" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruiters" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"company" text NOT NULL,
	"designation" text,
	"email" text NOT NULL,
	"linkedin" text,
	"notes" text DEFAULT '' NOT NULL,
	"status" "recruiter_status" DEFAULT 'Pending' NOT NULL,
	"template_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "send_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" "log_level" DEFAULT 'info' NOT NULL,
	"event" text NOT NULL,
	"message" text NOT NULL,
	"recruiter_id" integer,
	"queue_id" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"daily_limit" integer DEFAULT 50 NOT NULL,
	"min_delay_seconds" integer DEFAULT 45 NOT NULL,
	"max_delay_seconds" integer DEFAULT 150 NOT NULL,
	"start_time" text DEFAULT '09:00' NOT NULL,
	"end_time" text DEFAULT '18:00' NOT NULL,
	"retry_count" integer DEFAULT 4 NOT NULL,
	"retry_intervals_minutes" jsonb DEFAULT '[5,15,30,60]'::jsonb NOT NULL,
	"default_template_id" integer,
	"attachment_enabled" boolean DEFAULT false NOT NULL,
	"worker_status" text DEFAULT 'stopped' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_name" text NOT NULL,
	"stored_name" text NOT NULL,
	"path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiters" ADD CONSTRAINT "recruiters_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_logs" ADD CONSTRAINT "send_logs_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_logs" ADD CONSTRAINT "send_logs_queue_id_email_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."email_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_default_template_id_email_templates_id_fk" FOREIGN KEY ("default_template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recruiters_email_unique" ON "recruiters" USING btree ("email");