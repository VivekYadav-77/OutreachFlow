import { eq, sql } from "drizzle-orm";
import { db } from "../database/db.js";
import { emailQueue, emailReply, recruiters } from "../database/schema.js";
import { gmailProvider, parseAddressList } from "../providers/gmail.provider.js";
import { logActivitySummary, recordEmailActivity } from "./emailActivityService.js";

export type ReplyCheckSummary = {
  trackedThreads: number;
  checked: number;
  detected: number;
  duplicates: number;
  skipped: number;
};

function addressEmails(value?: string) {
  return parseAddressList(value ?? "").map((entry) => entry.email);
}

export async function checkReplies(): Promise<ReplyCheckSummary> {
  const summary: ReplyCheckSummary = { trackedThreads: 0, checked: 0, detected: 0, duplicates: 0, skipped: 0 };
  const ownEmail = await gmailProvider.getCurrentUserEmail();
  const tracked = await db
    .select({
      queueId: emailQueue.id,
      campaignId: emailQueue.campaignId,
      campaignRecipientId: emailQueue.campaignRecipientId,
      draftId: emailQueue.draftId,
      gmailThreadId: emailQueue.gmailThreadId,
      gmailMessageId: emailQueue.gmailMessageId,
      recruiterId: recruiters.id,
      recruiterEmail: recruiters.email
    })
    .from(emailQueue)
    .innerJoin(recruiters, eq(emailQueue.recruiterId, recruiters.id))
    .where(sql`${emailQueue.gmailThreadId} is not null`);

  summary.trackedThreads = tracked.length;

  for (const item of tracked) {
    if (!item.gmailThreadId) continue;
    summary.checked += 1;
    const messages = await gmailProvider.getThread(item.gmailThreadId);
    const candidates = messages
      .filter((message) => message.id !== item.gmailMessageId)
      .filter((message) => !addressEmails(message.from).includes(ownEmail ?? ""))
      .filter((message) => addressEmails(message.from).includes(item.recruiterEmail.toLowerCase()))
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

    const latest = candidates[0];
    if (!latest) {
      summary.skipped += 1;
      continue;
    }

    const repliedAt = latest.date ?? new Date();
    const [created] = await db
      .insert(emailReply)
      .values({
        recruiterId: item.recruiterId,
        campaignId: item.campaignId,
        gmailMessageId: latest.id,
        gmailThreadId: item.gmailThreadId,
        sender: latest.from ?? item.recruiterEmail,
        preview: latest.snippet,
        repliedAt,
        metadata: { queueId: item.queueId, draftId: item.draftId }
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      summary.duplicates += 1;
      continue;
    }

    summary.detected += 1;
    await recordEmailActivity({
      eventType: "REPLY_RECEIVED",
      recruiterId: item.recruiterId,
      campaignId: item.campaignId,
      campaignRecipientId: item.campaignRecipientId,
      queueId: item.queueId,
      draftId: item.draftId,
      gmailMessageId: latest.id,
      gmailThreadId: item.gmailThreadId,
      recruiterStatus: "REPLIED",
      occurredAt: repliedAt,
      metadata: { sender: latest.from, preview: latest.snippet }
    });
  }

  await logActivitySummary("email.replies_checked", `Detected ${summary.detected} replie(s)`, summary);
  return summary;
}
