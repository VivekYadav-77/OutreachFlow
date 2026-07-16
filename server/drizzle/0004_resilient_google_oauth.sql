DO $$ BEGIN
 CREATE TYPE "public"."oauth_connection_status" AS ENUM('CONNECTED', 'AUTH_REQUIRED', 'CONNECTING', 'DISCONNECTED', 'ERROR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."campaign_status" ADD VALUE IF NOT EXISTS 'PAUSED_AUTH';
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "pause_reason" text;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "paused_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "resumed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN IF NOT EXISTS "status" "oauth_connection_status" DEFAULT 'CONNECTED' NOT NULL;
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN IF NOT EXISTS "last_connected_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN IF NOT EXISTS "last_refresh_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN IF NOT EXISTS "last_auth_failure_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN IF NOT EXISTS "last_auth_failure_reason" text;
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN IF NOT EXISTS "last_reconnect_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN IF NOT EXISTS "last_token_refresh_attempt_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "oauth_tokens"
SET "status" = 'CONNECTED',
    "last_connected_at" = COALESCE("last_connected_at", "updated_at")
WHERE "provider" = 'google' AND "status" IS NULL;
