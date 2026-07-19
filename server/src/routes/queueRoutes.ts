import { Router } from "express";
import { emailWorker } from "../workers/emailWorker.js";
import { enqueuePendingRecruiters, getQueueSummary, getRetryableFailedJobs, pauseQueue, resumeQueue, retryFailedJobs, retryFailedJobsSchema, schedulePendingJobsFromNow, stopQueue } from "../queue/queueService.js";
import { getGoogleConnectionStatus } from "../services/oauthConnectionService.js";
import { AuthRequiredError } from "../utils/errors.js";
import { validate } from "../middleware/validate.js";

export const queueRoutes = Router();

queueRoutes.get("/", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getQueueSummary() });
  } catch (error) {
    next(error);
  }
});

queueRoutes.get("/failed", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getRetryableFailedJobs() });
  } catch (error) {
    next(error);
  }
});

queueRoutes.post("/start", async (_req, res, next) => {
  try {
    const auth = await getGoogleConnectionStatus();
    if (auth.status !== "CONNECTED") throw new AuthRequiredError();
    const enqueued = await enqueuePendingRecruiters();
    const scheduled = await schedulePendingJobsFromNow("worker.rescheduled_on_start");
    await emailWorker.start();
    res.json({ ok: true, data: { ...enqueued, ...scheduled, worker: "running" } });
  } catch (error) {
    next(error);
  }
});

queueRoutes.post("/pause", async (_req, res, next) => {
  try {
    await emailWorker.pause();
    await pauseQueue();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

queueRoutes.post("/resume", async (_req, res, next) => {
  try {
    const auth = await getGoogleConnectionStatus();
    if (auth.status !== "CONNECTED") throw new AuthRequiredError();
    await resumeQueue();
    await emailWorker.start();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

queueRoutes.post("/stop", async (_req, res, next) => {
  try {
    await emailWorker.stop();
    await stopQueue();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

queueRoutes.post("/retry-failed", validate("body", retryFailedJobsSchema), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await retryFailedJobs(req.body) });
  } catch (error) {
    next(error);
  }
});
