import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../database/db.js";
import { campaignRecipients, emailActivity, emailBounce, emailReply, gmailImportHistory, recruiters } from "../database/schema.js";
import { createLog } from "./logService.js";

export type EmailActivityEvent =
  | "CAMPAIGN_CREATED"
  | "QUEUED"
  | "SENDING"
  | "ACCEPTED_BY_GMAIL"
  | "TEMPORARY_FAILURE"
  | "BOUNCE"
  | "REPLY_RECEIVED"
  | "IMPORTED"
  | "MANUAL_RETRY"
  | "CAMPAIGN_PAUSED"
  | "CAMPAIGN_COMPLETED"
  | "SKIPPED";

type ActivityInput = {
  eventType: EmailActivityEvent;
  recruiterId?: number | null;
  campaignId?: number | null;
  campaignRecipientId?: number | null;
  queueId?: number | null;
  draftId?: number | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  metadata?: Record<string, unknown>;
  recruiterStatus?: string;
  campaignRecipientStatus?: string;
  occurredAt?: Date;
};

const ACTIVITY_TYPE_FILTERS = {
  replies: ["REPLY_RECEIVED"],
  bounces: ["BOUNCE"],
  imports: ["IMPORTED"]
} as const;

type ActivityListInput = {
  type?: "all" | keyof typeof ACTIVITY_TYPE_FILTERS;
  page?: number;
  pageSize?: number;
  search?: string;
  recruiterId?: number;
};

export function mapLifecycleToLegacyStatus(status: string) {
  switch (status) {
    case "NEW":
      return "Pending";
    case "QUEUED":
    case "SENDING":
      return "Pending";
    case "ACCEPTED_BY_GMAIL":
    case "COMPLETED":
      return "Sent";
    case "REPLIED":
      return "Replied";
    case "TEMPORARY_FAILURE":
    case "INVALID_ADDRESS":
      return "Failed";
    case "SKIPPED":
      return "Skipped";
    default:
      return status;
  }
}

export async function getRecruiterIsInvalidAddress(recruiterId: number) {
  const [recruiter] = await db.select({ status: recruiters.status }).from(recruiters).where(eq(recruiters.id, recruiterId)).limit(1);
  return recruiter?.status === "INVALID_ADDRESS";
}

export async function recordEmailActivity(input: ActivityInput) {
  const metadata = input.metadata ?? {};
  const [created] = await db
    .insert(emailActivity)
    .values({
      eventType: input.eventType,
      recruiterId: input.recruiterId ?? null,
      campaignId: input.campaignId ?? null,
      campaignRecipientId: input.campaignRecipientId ?? null,
      queueId: input.queueId ?? null,
      draftId: input.draftId ?? null,
      gmailMessageId: input.gmailMessageId ?? null,
      gmailThreadId: input.gmailThreadId ?? null,
      metadata,
      createdAt: input.occurredAt ?? new Date()
    })
    .onConflictDoNothing()
    .returning();

  if (input.recruiterId && input.recruiterStatus) {
    const status = input.recruiterStatus as never;
    const timestamp = input.occurredAt ?? new Date();
    await db
      .update(recruiters)
      .set({
        status,
        lastEmailSentAt: input.eventType === "ACCEPTED_BY_GMAIL" ? timestamp : undefined,
        lastReplyAt: input.eventType === "REPLY_RECEIVED" ? timestamp : undefined,
        lastBounceAt: input.eventType === "BOUNCE" ? timestamp : undefined,
        lastGmailMessageId: input.gmailMessageId ?? undefined,
        lastGmailThreadId: input.gmailThreadId ?? undefined,
        updatedAt: new Date()
      })
      .where(eq(recruiters.id, input.recruiterId));
  }

  if (input.campaignRecipientId && input.campaignRecipientStatus) {
    await db
      .update(campaignRecipients)
      .set({ status: input.campaignRecipientStatus as never, updatedAt: new Date() })
      .where(eq(campaignRecipients.id, input.campaignRecipientId));
  }

  return created;
}

export async function logActivitySummary(event: string, message: string, metadata: Record<string, unknown>) {
  await createLog({ event, message, metadata });
}

function activityTypeFilter(type: ActivityListInput["type"]) {
  if (!type || type === "all") return undefined;
  return inArray(emailActivity.eventType, [...ACTIVITY_TYPE_FILTERS[type]]);
}

export async function getEmailActivitySummary() {
  const [{ value: replies }] = await db.select({ value: count() }).from(emailReply);
  const [{ value: bounces }] = await db.select({ value: count() }).from(emailBounce);
  const [{ value: invalidAddresses }] = await db.select({ value: count() }).from(recruiters).where(eq(recruiters.status, "INVALID_ADDRESS"));
  const [{ value: importedEmails }] = await db.select({ value: count() }).from(gmailImportHistory);
  const [latest] = await db.select().from(emailActivity).orderBy(desc(emailActivity.createdAt)).limit(1);

  return {
    replies,
    bounces,
    invalidAddresses,
    importedEmails,
    lastActivityAt: latest?.createdAt ?? null
  };
}

export async function listEmailActivities(input: ActivityListInput = {}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const filters = [];
  const typeFilter = activityTypeFilter(input.type);
  if (typeFilter) filters.push(typeFilter);
  if (input.recruiterId) filters.push(eq(emailActivity.recruiterId, input.recruiterId));
  if (input.search) {
    const term = `%${input.search}%`;
    filters.push(or(ilike(recruiters.fullName, term), ilike(recruiters.company, term), ilike(recruiters.email, term), ilike(emailActivity.eventType, term)));
  }
  const where = filters.length ? and(...filters) : undefined;
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(emailActivity)
    .leftJoin(recruiters, eq(emailActivity.recruiterId, recruiters.id))
    .where(where);
  const rows = await db
    .select({
      id: emailActivity.id,
      eventType: emailActivity.eventType,
      recruiterId: emailActivity.recruiterId,
      campaignId: emailActivity.campaignId,
      queueId: emailActivity.queueId,
      gmailMessageId: emailActivity.gmailMessageId,
      gmailThreadId: emailActivity.gmailThreadId,
      metadata: emailActivity.metadata,
      createdAt: emailActivity.createdAt,
      recruiterName: recruiters.fullName,
      recruiterCompany: recruiters.company,
      recruiterEmail: recruiters.email
    })
    .from(emailActivity)
    .leftJoin(recruiters, eq(emailActivity.recruiterId, recruiters.id))
    .where(where)
    .orderBy(desc(emailActivity.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((row) => ({
      ...row,
      gmailThreadLink: row.gmailThreadId ? `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(row.gmailThreadId)}` : null
    })),
    total,
    page,
    pageSize
  };
}

export async function listRecruiterActivities(recruiterId: number) {
  const [recruiter] = await db.select().from(recruiters).where(eq(recruiters.id, recruiterId)).limit(1);
  const activities = await listEmailActivities({ recruiterId, pageSize: 25 });
  return {
    recruiter: recruiter
      ? {
          ...recruiter,
          gmailThreadLink: recruiter.lastGmailThreadId ? `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(recruiter.lastGmailThreadId)}` : null
        }
      : null,
    activities: activities.rows
  };
}
