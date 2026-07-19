import * as XLSX from "xlsx";
import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../database/db.js";
import { campaignRecipients, emailActivity, emailBounce, emailReply, gmailImportHistory, recruiters } from "../database/schema.js";
import { createLog } from "./logService.js";
import { ValidationError } from "../utils/errors.js";

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
  fromDate?: string;
  toDate?: string;
  fromTime?: string;
  toTime?: string;
  exportMode?: "all" | "withoutBounces";
};

type EmailActivityRow = Awaited<ReturnType<typeof selectEmailActivityRows>>[number];

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

function parseDateParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new ValidationError("Date filters must use YYYY-MM-DD format");
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3])
  };
}

function parseTimeParts(value: string | undefined, fallback: { hour: number; minute: number; second: number; millisecond: number }) {
  if (!value) return fallback;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) throw new ValidationError("Time filters must use HH:mm format");
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: fallback.second,
    millisecond: fallback.millisecond
  };
}

export function buildActivityDateRange(input: Pick<ActivityListInput, "fromDate" | "toDate" | "fromTime" | "toTime">) {
  const range: { from?: Date; to?: Date } = {};
  if (input.fromDate) {
    const date = parseDateParts(input.fromDate);
    const time = parseTimeParts(input.fromTime, { hour: 0, minute: 0, second: 0, millisecond: 0 });
    range.from = new Date(date.year, date.month, date.day, time.hour, time.minute, time.second, time.millisecond);
  }
  if (input.toDate) {
    const date = parseDateParts(input.toDate);
    const time = parseTimeParts(input.toTime, { hour: 23, minute: 59, second: 59, millisecond: 999 });
    range.to = new Date(date.year, date.month, date.day, time.hour, time.minute, time.second, time.millisecond);
  }
  if (range.from && range.to && range.from > range.to) {
    throw new ValidationError("From date/time cannot be after to date/time");
  }
  return range;
}

function buildActivityFilters(input: ActivityListInput) {
  const filters = [];
  const typeFilter = activityTypeFilter(input.type);
  if (typeFilter) filters.push(typeFilter);
  if (input.recruiterId) filters.push(eq(emailActivity.recruiterId, input.recruiterId));
  if (input.search) {
    const term = `%${input.search}%`;
    filters.push(or(ilike(recruiters.fullName, term), ilike(recruiters.company, term), ilike(recruiters.email, term), ilike(emailActivity.eventType, term)));
  }
  const range = buildActivityDateRange(input);
  if (range.from) filters.push(gte(emailActivity.createdAt, range.from));
  if (range.to) filters.push(lte(emailActivity.createdAt, range.to));
  if (input.exportMode === "withoutBounces") {
    filters.push(sql`(${recruiters.status} is null or ${recruiters.status} <> 'INVALID_ADDRESS')`);
    filters.push(sql`not exists (select 1 from ${emailBounce} where lower(${emailBounce.recipientEmail}) = lower(${recruiters.email}))`);
  }
  return filters.length ? and(...filters) : undefined;
}

async function selectEmailActivityRows(where: ReturnType<typeof buildActivityFilters>, limit?: number, offset?: number) {
  let query = db
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
      recruiterEmail: recruiters.email,
      recruiterStatus: recruiters.status,
      bounceType: sql<string | null>`(
        select ${emailBounce.bounceType}
        from ${emailBounce}
        where ${emailBounce.gmailMessageId} = ${emailActivity.gmailMessageId}
          or lower(${emailBounce.recipientEmail}) = lower(${recruiters.email})
        order by ${emailBounce.createdAt} desc
        limit 1
      )`,
      hasReply: sql<boolean>`exists (
        select 1
        from ${emailReply}
        where ${emailReply.recruiterId} = ${emailActivity.recruiterId}
      )`
    })
    .from(emailActivity)
    .leftJoin(recruiters, eq(emailActivity.recruiterId, recruiters.id))
    .where(where)
    .orderBy(desc(emailActivity.createdAt))
    .$dynamic();
  if (typeof limit === "number") query = query.limit(limit);
  if (typeof offset === "number") query = query.offset(offset);
  return query;
}

function withThreadLinks(rows: EmailActivityRow[]) {
  return rows.map((row) => ({
    ...row,
    gmailThreadLink: row.gmailThreadId ? `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(row.gmailThreadId)}` : null
  }));
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
  const where = buildActivityFilters(input);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(emailActivity)
    .leftJoin(recruiters, eq(emailActivity.recruiterId, recruiters.id))
    .where(where);
  const rows = await selectEmailActivityRows(where, pageSize, (page - 1) * pageSize);

  return {
    rows: withThreadLinks(rows),
    total,
    page,
    pageSize
  };
}

function readMetadata(row: EmailActivityRow, key: string) {
  const value = row.metadata?.[key];
  return value === null || value === undefined ? "" : String(value);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function padTimePart(value: number) {
  return String(value).padStart(2, "0");
}

export function formatActivityExportTimestamp(value: Date) {
  return {
    date: `${value.getFullYear()}-${padTimePart(value.getMonth() + 1)}-${padTimePart(value.getDate())}`,
    time: `${padTimePart(value.getHours())}:${padTimePart(value.getMinutes())}`
  };
}

export function resolveActivityExportBounceType(row: Pick<EmailActivityRow, "eventType" | "metadata" | "bounceType" | "recruiterStatus">) {
  const metadataValue = row.metadata?.bounceType;
  if (metadataValue) return String(metadataValue);
  if (row.bounceType) return row.bounceType;
  if (row.eventType === "BOUNCE" && (row.recruiterStatus === "INVALID_ADDRESS" || row.recruiterStatus === "TEMPORARY_FAILURE")) {
    return row.recruiterStatus;
  }
  return "";
}

export async function exportEmailActivities(input: ActivityListInput = {}) {
  const where = buildActivityFilters(input);
  const rows = withThreadLinks(await selectEmailActivityRows(where));
  const sheetRows = rows.map((row) => {
    const timestamp = formatActivityExportTimestamp(row.createdAt);
    return {
      "Event Type": row.eventType,
      "Recruiter Name": row.recruiterName ?? "",
      Company: row.recruiterCompany ?? "",
      Email: row.recruiterEmail ?? "",
      Status: row.recruiterStatus ?? "",
      Subject: readMetadata(row, "subject"),
      "Bounce Type": resolveActivityExportBounceType(row),
      Date: timestamp.date,
      Time: timestamp.time,
      Replies: row.hasReply ? "Yes" : "No"
    };
  });
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 24 },
    { wch: 24 },
    { wch: 32 },
    { wch: 18 },
    { wch: 48 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 }
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Email Activity");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const exportMode = input.exportMode === "withoutBounces" ? "without-bounces" : "all";
  return {
    buffer,
    filename: `email-activity-${exportMode}-${todayKey()}.xlsx`,
    count: rows.length
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
