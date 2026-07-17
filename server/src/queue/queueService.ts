import { and, asc, count, eq, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database/db.js";
import { campaignRecipients, emailDrafts, emailQueue, recruiters, emailDraftAttachments } from "../database/schema.js";
import { QueueError, ValidationError } from "../utils/errors.js";
import { createLog } from "../services/logService.js";
import { getSettings, setWorkerStatus } from "../services/settingsService.js";
import { getDefaultTemplate, getTemplate, renderTemplate } from "../services/templateService.js";

export const retryFailedJobsSchema = z.object({
  jobIds: z.array(z.coerce.number().int().positive()).min(1),
  retryAttempts: z.coerce.number().int().min(1).max(3)
});

export type RetryFailedJobsInput = z.infer<typeof retryFailedJobsSchema>;

export async function enqueuePendingRecruiters() {
  const settings = await getSettings();
  const defaultTemplate = await getDefaultTemplate().catch(() => null);
  const pendingRecruiters = await db.select().from(recruiters).where(eq(recruiters.status, "Pending")).orderBy(asc(recruiters.createdAt));
  let created = 0;
  let skipped = 0;

  for (const recruiter of pendingRecruiters) {
    const [{ value: activeJobs }] = await db
      .select({ value: count() })
      .from(emailQueue)
      .where(and(eq(emailQueue.recruiterId, recruiter.id), inArray(emailQueue.state, ["Pending", "Sending", "Retrying", "Paused"])));
    if (activeJobs > 0) {
      skipped += 1;
      continue;
    }

    const template = recruiter.templateId ? await getTemplate(recruiter.templateId).catch(() => defaultTemplate) : defaultTemplate;
    if (!template) {
      await db.update(recruiters).set({ status: "Failed", updatedAt: new Date() }).where(eq(recruiters.id, recruiter.id));
      await createLog({
        level: "error",
        event: "recruiter.failed",
        message: `Skipped enqueuing recruiter ${recruiter.email}: No template associated and no default template exists`,
        recruiterId: recruiter.id
      });
      skipped += 1;
      continue;
    }
    const rendered = renderTemplate(template, recruiter);
    const [draft] = await db
      .insert(emailDrafts)
      .values({
        to: [recruiter.email],
        cc: [],
        bcc: [],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        status: "Queued",
        queuedAt: new Date()
      })
      .returning();

    if (template && (template as any).attachments && (template as any).attachments.length > 0) {
      await db.insert(emailDraftAttachments).values(
        (template as any).attachments.map((file: any) => ({
          draftId: draft.id,
          fileId: file.id
        }))
      );
    }

    await db.insert(emailQueue).values({ draftId: draft.id, recruiterId: recruiter.id, maxAttempts: settings.retryCount });
    created += 1;
  }

  await createLog({ event: "queue.enqueued", message: `${created} personalized recruiter email(s) queued`, metadata: { created, skipped } });
  return { created, skipped };
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

export async function getRetryableFailedJobs() {
  return db
    .select({
      id: emailQueue.id,
      state: emailQueue.state,
      attempts: emailQueue.attempts,
      maxAttempts: emailQueue.maxAttempts,
      lastError: emailQueue.lastError,
      updatedAt: emailQueue.updatedAt,
      recruiterName: recruiters.fullName,
      recruiterCompany: recruiters.company,
      recruiterEmail: recruiters.email,
      draftTo: emailDrafts.to,
      draftSubject: emailDrafts.subject
    })
    .from(emailQueue)
    .leftJoin(recruiters, eq(emailQueue.recruiterId, recruiters.id))
    .leftJoin(emailDrafts, eq(emailQueue.draftId, emailDrafts.id))
    .where(eq(emailQueue.state, "Failed"))
    .orderBy(asc(emailQueue.updatedAt));
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

export async function retryFailedJobs(input: RetryFailedJobsInput) {
  const parsed = retryFailedJobsSchema.parse(input);
  const uniqueJobIds = [...new Set(parsed.jobIds)];
  if (uniqueJobIds.length !== parsed.jobIds.length) {
    throw new ValidationError("Duplicate queue jobs cannot be retried in the same request");
  }

  const jobs = await db.select().from(emailQueue).where(and(inArray(emailQueue.id, uniqueJobIds), eq(emailQueue.state, "Failed")));
  if (jobs.length !== uniqueJobIds.length) {
    throw new QueueError("Only failed queue jobs can be retried");
  }

  const result = await db
    .update(emailQueue)
    .set({
      state: "Pending",
      attempts: 0,
      maxAttempts: parsed.retryAttempts,
      lastError: null,
      failureType: null,
      nextAttemptAt: null,
      updatedAt: new Date()
    })
    .where(and(inArray(emailQueue.id, uniqueJobIds), eq(emailQueue.state, "Failed")))
    .returning();
  await createLog({
    event: "queue.retry_failed",
    message: `${result.length} failed job(s) queued for retry`,
    metadata: { count: result.length, jobIds: uniqueJobIds, retryAttempts: parsed.retryAttempts }
  });
  return { queued: result.length };
}
