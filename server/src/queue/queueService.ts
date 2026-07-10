import { and, asc, count, eq, lte, or, sql } from "drizzle-orm";
import { db } from "../database/db.js";
import { campaignRecipients, emailQueue, recruiters } from "../database/schema.js";
import { QueueError } from "../utils/errors.js";
import { createLog } from "../services/logService.js";
import { getSettings, setWorkerStatus } from "../services/settingsService.js";

export async function enqueuePendingRecruiters() {
  await createLog({ event: "queue.start", message: "Worker start requested; composer drafts are queued from the Compose page" });
  return { created: 0 };
}

export async function getQueueSummary() {
  const rows = await db
    .select({ state: emailQueue.state, value: count() })
    .from(emailQueue)
    .groupBy(emailQueue.state);
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.state] = row.value;
    return acc;
  }, {});
}

export async function pickNextJob() {
  const now = new Date();
  const [job] = await db
    .select()
    .from(emailQueue)
    .where(
      or(
        eq(emailQueue.state, "Pending"),
        and(eq(emailQueue.state, "Retrying"), or(sql`${emailQueue.nextAttemptAt} is null`, lte(emailQueue.nextAttemptAt, now)))
      )
    )
    .orderBy(asc(emailQueue.createdAt))
    .limit(1);
  if (!job) return undefined;
  const [updated] = await db.update(emailQueue).set({ state: "Sending", updatedAt: new Date() }).where(eq(emailQueue.id, job.id)).returning();
  return updated;
}

export async function markJobSent(jobId: number, gmailMessageId?: string) {
  const [job] = await db.update(emailQueue).set({ state: "Sent", sentAt: new Date(), gmailMessageId, updatedAt: new Date() }).where(eq(emailQueue.id, jobId)).returning();
  if (job.recruiterId) {
    await db.update(recruiters).set({ status: "Sent", updatedAt: new Date() }).where(eq(recruiters.id, job.recruiterId));
  }
  if (job.campaignRecipientId) {
    await db.update(campaignRecipients).set({ status: "Sent", updatedAt: new Date() }).where(eq(campaignRecipients.id, job.campaignRecipientId));
  }
  return job;
}

export async function markJobFailed(jobId: number, message: string, failureType: "Temporary" | "Permanent" = "Permanent") {
  const [job] = await db.update(emailQueue).set({ state: "Failed", failureType, lastError: message, updatedAt: new Date() }).where(eq(emailQueue.id, jobId)).returning();
  if (job.recruiterId) {
    await db.update(recruiters).set({ status: "Failed", updatedAt: new Date() }).where(eq(recruiters.id, job.recruiterId));
  }
  if (job.campaignRecipientId) {
    await db.update(campaignRecipients).set({ status: "Failed", updatedAt: new Date() }).where(eq(campaignRecipients.id, job.campaignRecipientId));
  }
  return job;
}

export async function scheduleRetry(jobId: number, message: string) {
  const [job] = await db.select().from(emailQueue).where(eq(emailQueue.id, jobId));
  if (!job) throw new QueueError("Queue job not found");
  const settings = await getSettings();
  const attempts = job.attempts + 1;
  if (attempts >= job.maxAttempts) return markJobFailed(jobId, message, "Temporary");
  const interval = settings.retryIntervalsMinutes[Math.min(attempts - 1, settings.retryIntervalsMinutes.length - 1)] ?? 60;
  const nextAttemptAt = new Date(Date.now() + interval * 60 * 1000);
  const [updated] = await db
    .update(emailQueue)
    .set({ state: "Retrying", attempts, nextAttemptAt, failureType: "Temporary", lastError: message, updatedAt: new Date() })
    .where(eq(emailQueue.id, jobId))
    .returning();
  await createLog({ event: "queue.retry", message: "Temporary failure scheduled for retry", queueId: jobId, metadata: { attempts, nextAttemptAt } });
  return updated;
}

export async function pauseQueue() {
  await setWorkerStatus("paused");
  await db.update(emailQueue).set({ state: "Paused", updatedAt: new Date() }).where(eq(emailQueue.state, "Pending"));
  await createLog({ event: "worker.paused", message: "Worker paused" });
}

export async function resumeQueue() {
  await setWorkerStatus("running");
  await db.update(emailQueue).set({ state: "Pending", updatedAt: new Date() }).where(eq(emailQueue.state, "Paused"));
  await createLog({ event: "worker.resumed", message: "Worker resumed" });
}

export async function stopQueue() {
  await setWorkerStatus("stopped");
  await createLog({ event: "worker.stopped", message: "Worker stopped" });
}

export async function retryFailedJobs() {
  const result = await db.update(emailQueue).set({ state: "Pending", attempts: 0, lastError: null, nextAttemptAt: null, updatedAt: new Date() }).where(eq(emailQueue.state, "Failed")).returning();
  await createLog({ event: "queue.retry_failed", message: `${result.length} failed job(s) queued for retry`, metadata: { count: result.length } });
  return { queued: result.length };
}
