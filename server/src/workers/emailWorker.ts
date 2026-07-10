import { eq, sql } from "drizzle-orm";
import { db } from "../database/db.js";
import { dailyStats, recruiters } from "../database/schema.js";
import { getComposedEmailWithAttachments, markDraftFailed, markDraftSending, markDraftSent } from "../services/draftService.js";
import { emailService } from "../services/emailService.js";
import { createLog } from "../services/logService.js";
import { getSettings, setWorkerStatus } from "../services/settingsService.js";
import { markJobFailed, markJobSent, pickNextJob, scheduleRetry } from "../queue/queueService.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isWithinWorkingHours(startTime: string, endTime: string) {
  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return current >= startTime && current <= endTime;
}

async function getTodayStats() {
  const date = todayKey();
  const [existing] = await db.select().from(dailyStats).where(eq(dailyStats.date, date));
  if (existing) return existing;
  const [created] = await db.insert(dailyStats).values({ date }).returning();
  return created;
}

async function incrementStats(success: boolean, sendTimeMs: number) {
  const stats = await getTodayStats();
  await db
    .update(dailyStats)
    .set({
      sentCount: success ? stats.sentCount + 1 : stats.sentCount,
      failedCount: success ? stats.failedCount : stats.failedCount + 1,
      totalSendTimeMs: stats.totalSendTimeMs + sendTimeMs,
      updatedAt: new Date()
    })
    .where(eq(dailyStats.id, stats.id));
}

class EmailWorker {
  private running = false;

  isRunning() {
    return this.running;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    await setWorkerStatus("running");
    await createLog({ event: "worker.started", message: "Worker started" });
    void this.loop();
  }

  async pause() {
    this.running = false;
    await setWorkerStatus("paused");
  }

  async stop() {
    this.running = false;
    await setWorkerStatus("stopped");
  }

  private async loop() {
    while (this.running) {
      const settings = await getSettings();
      if (settings.workerStatus !== "running") {
        this.running = false;
        break;
      }

      if (!isWithinWorkingHours(settings.startTime, settings.endTime)) {
        await sleep(60_000);
        continue;
      }

      const stats = await getTodayStats();
      if (stats.sentCount >= settings.dailyLimit) {
        await createLog({ event: "worker.daily_limit", message: "Daily sending limit reached" });
        await sleep(15 * 60_000);
        continue;
      }

      const job = await pickNextJob();
      if (!job) {
        await sleep(30_000);
        continue;
      }

      const started = Date.now();
      try {
        let result;
        let logMessage = "Email sent";
        let recruiterId: number | undefined;
        if (job.draftId) {
          recruiterId = job.recruiterId ?? undefined;
          await markDraftSending(job.draftId);
          const email = await getComposedEmailWithAttachments(job.draftId);
          result = await emailService.sendComposedEmail(email);
          await markDraftSent(job.draftId, result.providerMessageId);
          logMessage = `Email sent to ${email.to.join(", ")}`;
        } else if (job.recruiterId) {
          const [recruiter] = await db.select().from(recruiters).where(eq(recruiters.id, job.recruiterId));
          recruiterId = recruiter?.id;
          throw new Error("Legacy recruiter queue jobs are no longer supported. Create and queue an email from Compose.");
        } else {
          throw new Error("Queue job is missing a draft");
        }
        await markJobSent(job.id, result.providerMessageId);
        await incrementStats(true, Date.now() - started);
        await createLog({ event: "email.sent", message: logMessage, recruiterId, queueId: job.id, metadata: job.draftId ? { draftId: job.draftId } : {} });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Gmail send failure";
        if (job.draftId) await markDraftFailed(job.draftId, message);
        if (emailService.classifyError(error) === "temporary") {
          await scheduleRetry(job.id, message);
        } else {
          await markJobFailed(job.id, message, "Permanent");
          await incrementStats(false, Date.now() - started);
          await createLog({ level: "error", event: "email.failed", message, queueId: job.id });
        }
      }

      const delaySeconds = Math.floor(Math.random() * (settings.maxDelaySeconds - settings.minDelaySeconds + 1)) + settings.minDelaySeconds;
      await sleep(delaySeconds * 1000);
    }
  }
}

export const emailWorker = new EmailWorker();
