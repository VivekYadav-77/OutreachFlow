import { Router } from "express";
import { schedulePendingJobsFromNow } from "../queue/queueService.js";
import { validate } from "../middleware/validate.js";
import { getSettings, settingsSchema, updateSettings } from "../services/settingsService.js";

export const settingsRoutes = Router();

settingsRoutes.get("/", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getSettings() });
  } catch (error) {
    next(error);
  }
});

settingsRoutes.put("/", validate("body", settingsSchema), async (req, res, next) => {
  try {
    const before = await getSettings();
    const updated = await updateSettings(req.body);
    const delayChanged =
      updated.minDelaySeconds !== before.minDelaySeconds ||
      updated.maxDelaySeconds !== before.maxDelaySeconds;
    if (delayChanged) {
      await schedulePendingJobsFromNow("settings.rescheduled_after_delay_change");
    }
    res.json({ ok: true, data: updated });
  } catch (error) {
    next(error);
  }
});
