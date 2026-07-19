import { count, eq, sql, desc, inArray } from "drizzle-orm";
import { db } from "../database/db.js";
import { dailyStats, emailBounce, emailQueue, emailReply, recruiters } from "../database/schema.js";
import { getQueueSummary } from "../queue/queueService.js";
import { getSettings } from "./settingsService.js";
import { getAuthStatus } from "../auth/googleAuth.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function getStatistics() {
  const settings = await getSettings();
  const [today] = await db.select().from(dailyStats).where(eq(dailyStats.date, todayKey())).limit(1);
  const [{ value: totalSent }] = await db.select({ value: count() }).from(recruiters).where(inArray(recruiters.status, ["Sent", "ACCEPTED_BY_GMAIL", "COMPLETED"]));
  const [{ value: pending }] = await db.select({ value: count() }).from(recruiters).where(inArray(recruiters.status, ["Pending", "NEW", "QUEUED", "SENDING"]));
  const [{ value: failed }] = await db.select({ value: count() }).from(recruiters).where(inArray(recruiters.status, ["Failed", "TEMPORARY_FAILURE", "INVALID_ADDRESS"]));
  const [{ value: retries }] = await db.select({ value: count() }).from(emailQueue).where(eq(emailQueue.state, "Retrying"));
  const [{ value: replies }] = await db.select({ value: count() }).from(emailReply);
  const [{ value: bounces }] = await db.select({ value: count() }).from(emailBounce);
  const [{ value: temporaryFailures }] = await db.select({ value: count() }).from(recruiters).where(eq(recruiters.status, "TEMPORARY_FAILURE"));
  const [{ value: invalidAddresses }] = await db.select({ value: count() }).from(recruiters).where(eq(recruiters.status, "INVALID_ADDRESS"));
  const [{ value: queuedRecruiters }] = await db.select({ value: count() }).from(recruiters).where(eq(recruiters.status, "QUEUED"));
  const sent = totalSent;
  const totalCompleted = sent + failed;
  const successRate = totalCompleted ? Math.round((sent / totalCompleted) * 100) : 0;
  const averageSendTimeMs = today && today.sentCount + today.failedCount > 0 ? Math.round(today.totalSendTimeMs / (today.sentCount + today.failedCount)) : 0;
  const daysRemaining = settings.dailyLimit > 0 ? Math.ceil(pending / settings.dailyLimit) : 0;
  const completion = new Date();
  completion.setDate(completion.getDate() + daysRemaining);

  const queueItems = await db
    .select({
      id: emailQueue.id,
      state: emailQueue.state,
      attempts: emailQueue.attempts,
      maxAttempts: emailQueue.maxAttempts,
      lastError: emailQueue.lastError,
      nextAttemptAt: emailQueue.nextAttemptAt,
      sentAt: emailQueue.sentAt,
      updatedAt: emailQueue.updatedAt,
      recruiterName: recruiters.fullName,
      recruiterCompany: recruiters.company,
      recruiterEmail: recruiters.email
    })
    .from(emailQueue)
    .leftJoin(recruiters, eq(emailQueue.recruiterId, recruiters.id))
    .orderBy(desc(emailQueue.updatedAt))
    .limit(500);

  return {
    todaySent: today?.sentCount ?? 0,
    totalSent,
    pending,
    failed,
    retries,
    replies,
    bounces,
    temporaryFailures,
    invalidAddresses,
    queuedRecruiters,
    successRate,
    averageSendTimeMs,
    remainingRecruiters: pending,
    estimatedCompletionDate: pending ? completion.toISOString().slice(0, 10) : null,
    workerStatus: settings.workerStatus,
    authStatus: await getAuthStatus(),
    queue: await getQueueSummary(),
    queueItems
  };
}
