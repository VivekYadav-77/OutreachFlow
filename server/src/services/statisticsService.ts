import { count, eq, sql } from "drizzle-orm";
import { db } from "../database/db.js";
import { dailyStats, emailQueue, recruiters } from "../database/schema.js";
import { getQueueSummary } from "../queue/queueService.js";
import { getSettings } from "./settingsService.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function getStatistics() {
  const settings = await getSettings();
  const [today] = await db.select().from(dailyStats).where(eq(dailyStats.date, todayKey())).limit(1);
  const [{ value: totalSent }] = await db.select({ value: count() }).from(recruiters).where(eq(recruiters.status, "Sent"));
  const [{ value: pending }] = await db.select({ value: count() }).from(recruiters).where(eq(recruiters.status, "Pending"));
  const [{ value: failed }] = await db.select({ value: count() }).from(recruiters).where(eq(recruiters.status, "Failed"));
  const [{ value: retries }] = await db.select({ value: count() }).from(emailQueue).where(eq(emailQueue.state, "Retrying"));
  const sent = totalSent;
  const totalCompleted = sent + failed;
  const successRate = totalCompleted ? Math.round((sent / totalCompleted) * 100) : 0;
  const averageSendTimeMs = today && today.sentCount + today.failedCount > 0 ? Math.round(today.totalSendTimeMs / (today.sentCount + today.failedCount)) : 0;
  const daysRemaining = settings.dailyLimit > 0 ? Math.ceil(pending / settings.dailyLimit) : 0;
  const completion = new Date();
  completion.setDate(completion.getDate() + daysRemaining);
  return {
    todaySent: today?.sentCount ?? 0,
    totalSent,
    pending,
    failed,
    retries,
    successRate,
    averageSendTimeMs,
    remainingRecruiters: pending,
    estimatedCompletionDate: pending ? completion.toISOString().slice(0, 10) : null,
    workerStatus: settings.workerStatus,
    queue: await getQueueSummary()
  };
}
