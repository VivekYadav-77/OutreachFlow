import { Router } from "express";
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
    res.json({ ok: true, data: await updateSettings(req.body) });
  } catch (error) {
    next(error);
  }
});
