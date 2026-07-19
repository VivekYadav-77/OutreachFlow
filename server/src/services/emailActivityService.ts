import { eq } from "drizzle-orm";
import { db } from "../database/db.js";
import { campaignRecipients, emailActivity, recruiters } from "../database/schema.js";
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
