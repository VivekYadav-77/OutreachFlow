import {
  boolean,
  integer,
  jsonb,
  primaryKey,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const recruiterStatus = pgEnum("recruiter_status", ["Pending", "Sent", "Failed", "Replied", "Skipped"]);
export const queueState = pgEnum("queue_state", ["Pending", "Sending", "Sent", "Failed", "Retrying", "Paused"]);
export const logLevel = pgEnum("log_level", ["info", "warn", "error"]);
export const campaignStatus = pgEnum("campaign_status", ["Draft", "Scheduled", "Running", "Paused", "Completed", "Cancelled"]);
export const campaignRecipientStatus = pgEnum("campaign_recipient_status", ["Pending", "Queued", "Sending", "Sent", "Failed", "Skipped"]);
export const failureType = pgEnum("failure_type", ["Temporary", "Permanent"]);
export const emailDraftStatus = pgEnum("email_draft_status", ["Draft", "Queued", "Sending", "Sent", "Failed"]);

export const recruiters = pgTable(
  "recruiters",
  {
    id: serial("id").primaryKey(),
    fullName: text("full_name").notNull(),
    company: text("company").notNull(),
    designation: text("designation"),
    email: text("email").notNull(),
    linkedin: text("linkedin"),
    notes: text("notes").notNull().default(""),
    status: recruiterStatus("status").notNull().default("Pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    emailUnique: uniqueIndex("recruiters_email_unique").on(table.email)
  })
);

export const uploadedFiles = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  kind: text("kind").notNull().default("resume"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const emailDrafts = pgTable("email_drafts", {
  id: serial("id").primaryKey(),
  to: jsonb("to").$type<string[]>().notNull().default([]),
  cc: jsonb("cc").$type<string[]>().notNull().default([]),
  bcc: jsonb("bcc").$type<string[]>().notNull().default([]),
  subject: text("subject").notNull().default(""),
  html: text("html").notNull().default(""),
  text: text("text").notNull().default(""),
  status: emailDraftStatus("status").notNull().default("Draft"),
  lastError: text("last_error"),
  gmailMessageId: text("gmail_message_id"),
  queuedAt: timestamp("queued_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const emailDraftAttachments = pgTable(
  "email_draft_attachments",
  {
    draftId: integer("draft_id")
      .notNull()
      .references(() => emailDrafts.id, { onDelete: "cascade" }),
    fileId: integer("file_id")
      .notNull()
      .references(() => uploadedFiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.draftId, table.fileId] })
  })
);

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: campaignStatus("status").notNull().default("Draft"),
  resumeFileId: integer("resume_file_id").references(() => uploadedFiles.id, { onDelete: "set null" }),
  dailyLimit: integer("daily_limit").notNull().default(50),
  minDelaySeconds: integer("min_delay_seconds").notNull().default(45),
  maxDelaySeconds: integer("max_delay_seconds").notNull().default(150),
  startTime: text("start_time").notNull().default("09:00"),
  endTime: text("end_time").notNull().default("18:00"),
  retryCount: integer("retry_count").notNull().default(4),
  retryIntervalsMinutes: jsonb("retry_intervals_minutes").$type<number[]>().notNull().default([5, 15, 30, 60]),
  attachmentEnabled: boolean("attachment_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    recruiterId: integer("recruiter_id")
      .notNull()
      .references(() => recruiters.id, { onDelete: "cascade" }),
    status: campaignRecipientStatus("status").notNull().default("Pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    campaignRecruiterUnique: uniqueIndex("campaign_recipients_campaign_recruiter_unique").on(table.campaignId, table.recruiterId)
  })
);

export const emailQueue = pgTable("email_queue", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  campaignRecipientId: integer("campaign_recipient_id").references(() => campaignRecipients.id, { onDelete: "cascade" }),
  recruiterId: integer("recruiter_id").references(() => recruiters.id, { onDelete: "cascade" }),
  draftId: integer("draft_id").references(() => emailDrafts.id, { onDelete: "cascade" }),
  state: queueState("state").notNull().default("Pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(4),
  lastError: text("last_error"),
  failureType: failureType("failure_type"),
  gmailMessageId: text("gmail_message_id"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  dailyLimit: integer("daily_limit").notNull().default(50),
  minDelaySeconds: integer("min_delay_seconds").notNull().default(45),
  maxDelaySeconds: integer("max_delay_seconds").notNull().default(150),
  startTime: text("start_time").notNull().default("09:00"),
  endTime: text("end_time").notNull().default("18:00"),
  retryCount: integer("retry_count").notNull().default(4),
  retryIntervalsMinutes: jsonb("retry_intervals_minutes").$type<number[]>().notNull().default([5, 15, 30, 60]),
  attachmentEnabled: boolean("attachment_enabled").notNull().default(false),
  workerStatus: text("worker_status").notNull().default("stopped"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const oauthTokens = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("google"),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  scope: text("scope"),
  tokenType: text("token_type"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const sendLogs = pgTable("send_logs", {
  id: serial("id").primaryKey(),
  level: logLevel("level").notNull().default("info"),
  event: text("event").notNull(),
  message: text("message").notNull(),
  recruiterId: integer("recruiter_id").references(() => recruiters.id, { onDelete: "set null" }),
  queueId: integer("queue_id").references(() => emailQueue.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const dailyStats = pgTable("daily_stats", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  totalSendTimeMs: integer("total_send_time_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const campaignDailyStats = pgTable(
  "campaign_daily_stats",
  {
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    temporaryFailureCount: integer("temporary_failure_count").notNull().default(0),
    permanentFailureCount: integer("permanent_failure_count").notNull().default(0),
    retryCount: integer("retry_count").notNull().default(0),
    totalSendTimeMs: integer("total_send_time_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.campaignId, table.date] })
  })
);

export type Recruiter = typeof recruiters.$inferSelect;
export type NewRecruiter = typeof recruiters.$inferInsert;
export type EmailQueueJob = typeof emailQueue.$inferSelect;
export type EmailDraft = typeof emailDrafts.$inferSelect;
export type AppSettings = typeof settings.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
