import { Router } from "express";
import { emailWorker } from "../workers/emailWorker.js";
import { enqueuePendingRecruiters, getQueueSummary, pauseQueue, resumeQueue, retryFailedJobs, stopQueue } from "../queue/queueService.js";

export const queueRoutes = Router();

queueRoutes.get("/", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getQueueSummary() });
  } catch (error) {
    next(error);
  }
});

queueRoutes.post("/start", async (_req, res, next) => {
  try {
    const enqueued = await enqueuePendingRecruiters();
    await emailWorker.start();
    res.json({ ok: true, data: { ...enqueued, worker: "running" } });
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

queueRoutes.post("/retry-failed", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await retryFailedJobs() });
  } catch (error) {
    next(error);
  }
});
