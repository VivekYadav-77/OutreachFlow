import { and, asc, count, eq, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database/db.js";
import { campaignRecipients, emailDrafts, emailQueue, recruiters, emailDraftAttachments } from "../database/schema.js";
import { QueueError, ValidationError } from "../utils/errors.js";
import { createLog } from "../services/logService.js";
import { getRecruiterIsInvalidAddress, recordEmailActivity } from "../services/emailActivityService.js";
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
  const pendingRecruiters = await db.select().from(recruiters).where(inArray(recruiters.status, ["Pending", "NEW"])).orderBy(asc(recruiters.createdAt));
  let created = 0;
  let skipped = 0;

  for (const recruiter of pendingRecruiters) {
    const [{ value: activeJobs }] = await db
      .select({ value: count() })
      .from(emailQueue)
      .where(and(eq(emailQueue.recruiterId, recruiter.id), inArray(emailQueue.state, ["Pending", "Sending", "Retrying", "Paused"])));
    if (activeJobs > 0 || recruiter.status === "INVALID_ADDRESS") {
      skipped += 1;
      continue;
    }

    const template = recruiter.templateId ? await getTemplate(recruiter.templateId).catch(() => defaultTemplate) : defaultTemplate;
    if (!template) {
      await recordEmailActivity({
        eventType: "SKIPPED",
        recruiterId: recruiter.id,
        recruiterStatus: "Failed",
        metadata: { reason: "No template associated and no default template exists" }
      });
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

    const [job] = await db.insert(emailQueue).values({ draftId: draft.id, recruiterId: recruiter.id, maxAttempts: settings.retryCount }).returning();
    await recordEmailActivity({
      eventType: "QUEUED",
      recruiterId: recruiter.id,
      queueId: job.id,
      draftId: draft.id,
      recruiterStatus: "QUEUED",
      metadata: { source: "queue.start" }
    });
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
  if (updated.recruiterId && await getRecruiterIsInvalidAddress(updated.recruiterId)) {
    await markJobFailed(updated.id, "Recruiter address is permanently invalid", "Permanent");
    return pickNextJob();
  }
  if (updated.recruiterId) {
    await recordEmailActivity({
      eventType: "SENDING",
      recruiterId: updated.recruiterId,
      campaignId: updated.campaignId,
      campaignRecipientId: updated.campaignRecipientId,
      queueId: updated.id,
      draftId: updated.draftId,
      recruiterStatus: "SENDING",
      campaignRecipientStatus: "Sending"
    });
  }
  return updated;
}

export async function markJobSent(jobId: number, gmailMessageId?: string, gmailThreadId?: string) {
  const sentAt = new Date();
  const [job] = await db.update(emailQueue).set({ state: "Sent", sentAt, gmailMessageId, gmailThreadId, updatedAt: new Date() }).where(eq(emailQueue.id, jobId)).returning();
  if (job.recruiterId) {
    await recordEmailActivity({
      eventType: "ACCEPTED_BY_GMAIL",
      recruiterId: job.recruiterId,
      campaignId: job.campaignId,
      campaignRecipientId: job.campaignRecipientId,
      queueId: job.id,
      draftId: job.draftId,
      gmailMessageId,
      gmailThreadId,
      recruiterStatus: "ACCEPTED_BY_GMAIL",
      campaignRecipientStatus: "Sent",
      occurredAt: sentAt
    });
  }
  return job;
}

export async function markJobFailed(jobId: number, message: string, failureType: "Temporary" | "Permanent" = "Permanent") {
  const [job] = await db.update(emailQueue).set({ state: "Failed", failureType, lastError: message, updatedAt: new Date() }).where(eq(emailQueue.id, jobId)).returning();
  if (job.recruiterId) {
    await recordEmailActivity({
      eventType: failureType === "Temporary" ? "TEMPORARY_FAILURE" : "SKIPPED",
      recruiterId: job.recruiterId,
      campaignId: job.campaignId,
      campaignRecipientId: job.campaignRecipientId,
      queueId: job.id,
      draftId: job.draftId,
      recruiterStatus: failureType === "Temporary" ? "TEMPORARY_FAILURE" : "Failed",
      campaignRecipientStatus: "Failed",
      metadata: { message, failureType }
    });
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
  for (const job of jobs) {
    if (job.recruiterId && await getRecruiterIsInvalidAddress(job.recruiterId)) {
      throw new QueueError("Permanently invalid recruiter addresses cannot be retried");
    }
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
  for (const job of result) {
    if (job.recruiterId) {
      await recordEmailActivity({
        eventType: "MANUAL_RETRY",
        recruiterId: job.recruiterId,
        campaignId: job.campaignId,
        campaignRecipientId: job.campaignRecipientId,
        queueId: job.id,
        draftId: job.draftId,
        recruiterStatus: "QUEUED",
        campaignRecipientStatus: "Queued",
        metadata: { retryAttempts: parsed.retryAttempts }
      });
    }
  }
  return { queued: result.length };
}
