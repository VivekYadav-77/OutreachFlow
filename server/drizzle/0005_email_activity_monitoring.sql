ALTER TYPE "public"."recruiter_status" ADD VALUE IF NOT EXISTS 'NEW';
ALTER TYPE "public"."recruiter_status" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "public"."recruiter_status" ADD VALUE IF NOT EXISTS 'SENDING';
ALTER TYPE "public"."recruiter_status" ADD VALUE IF NOT EXISTS 'ACCEPTED_BY_GMAIL';
ALTER TYPE "public"."recruiter_status" ADD VALUE IF NOT EXISTS 'REPLIED';
ALTER TYPE "public"."recruiter_status" ADD VALUE IF NOT EXISTS 'TEMPORARY_FAILURE';
ALTER TYPE "public"."recruiter_status" ADD VALUE IF NOT EXISTS 'INVALID_ADDRESS';
ALTER TYPE "public"."recruiter_status" ADD VALUE IF NOT EXISTS 'SKIPPED';
ALTER TYPE "public"."recruiter_status" ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TABLE "recruiters" ADD COLUMN IF NOT EXISTS "last_email_sent_at" timestamp with time zone;
ALTER TABLE "recruiters" ADD COLUMN IF NOT EXISTS "last_reply_at" timestamp with time zone;
ALTER TABLE "recruiters" ADD COLUMN IF NOT EXISTS "last_bounce_at" timestamp with time zone;
ALTER TABLE "recruiters" ADD COLUMN IF NOT EXISTS "last_gmail_thread_id" text;
ALTER TABLE "recruiters" ADD COLUMN IF NOT EXISTS "last_gmail_message_id" text;
ALTER TABLE "recruiters" ADD COLUMN IF NOT EXISTS "imported_from_gmail" boolean DEFAULT false NOT NULL;
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "gmail_thread_id" text;
ALTER TABLE "email_queue" ADD COLUMN IF NOT EXISTS "gmail_thread_id" text;

CREATE TABLE IF NOT EXISTS "email_activity" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_type" text NOT NULL,
  "recruiter_id" integer,
  "campaign_id" integer,
  "campaign_recipient_id" integer,
  "queue_id" integer,
  "draft_id" integer,
  "gmail_message_id" text,
  "gmail_thread_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "email_reply" (
  "id" serial PRIMARY KEY NOT NULL,
  "recruiter_id" integer,
  "campaign_id" integer,
  "gmail_message_id" text NOT NULL,
  "gmail_thread_id" text NOT NULL,
  "sender" text NOT NULL,
  "preview" text DEFAULT '' NOT NULL,
  "replied_at" timestamp with time zone NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "email_bounce" (
  "id" serial PRIMARY KEY NOT NULL,
  "recruiter_id" integer,
  "campaign_id" integer,
  "recipient_email" text NOT NULL,
  "bounce_type" text NOT NULL,
  "reason" text DEFAULT '' NOT NULL,
  "smtp_code" text,
  "gmail_message_id" text NOT NULL,
  "gmail_thread_id" text,
  "bounced_at" timestamp with time zone NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gmail_import_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "gmail_message_id" text NOT NULL,
  "gmail_thread_id" text,
  "recruiter_id" integer,
  "campaign_id" integer,
  "recipient_email" text NOT NULL,
  "recipient_name" text,
  "subject" text DEFAULT '' NOT NULL,
  "snippet" text DEFAULT '' NOT NULL,
  "sent_at" timestamp with time zone NOT NULL,
  "labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "email_activity" ADD CONSTRAINT "email_activity_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "email_activity" ADD CONSTRAINT "email_activity_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "email_activity" ADD CONSTRAINT "email_activity_campaign_recipient_id_campaign_recipients_id_fk" FOREIGN KEY ("campaign_recipient_id") REFERENCES "public"."campaign_recipients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "email_activity" ADD CONSTRAINT "email_activity_queue_id_email_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."email_queue"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "email_activity" ADD CONSTRAINT "email_activity_draft_id_email_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."email_drafts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "email_reply" ADD CONSTRAINT "email_reply_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "email_reply" ADD CONSTRAINT "email_reply_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "email_bounce" ADD CONSTRAINT "email_bounce_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "email_bounce" ADD CONSTRAINT "email_bounce_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "gmail_import_history" ADD CONSTRAINT "gmail_import_history_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "gmail_import_history" ADD CONSTRAINT "gmail_import_history_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "email_activity_message_event_unique" ON "email_activity" ("gmail_message_id", "event_type");
CREATE UNIQUE INDEX IF NOT EXISTS "email_reply_gmail_message_unique" ON "email_reply" ("gmail_message_id");
CREATE UNIQUE INDEX IF NOT EXISTS "email_bounce_gmail_message_recipient_unique" ON "email_bounce" ("gmail_message_id", "recipient_email");
CREATE UNIQUE INDEX IF NOT EXISTS "gmail_import_history_message_unique" ON "gmail_import_history" ("gmail_message_id");
