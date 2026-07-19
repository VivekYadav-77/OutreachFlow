import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { getEmailActivitySummary, listEmailActivities } from "../services/emailActivityService.js";

const activityQuerySchema = z.object({
  type: z.enum(["all", "replies", "bounces", "imports"]).optional().default("all"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  search: z.string().optional()
});

export const emailActivityRoutes = Router();

emailActivityRoutes.get("/summary", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getEmailActivitySummary() });
  } catch (error) {
    next(error);
  }
});

emailActivityRoutes.get("/", validate("query", activityQuerySchema), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await listEmailActivities(req.query as never) });
  } catch (error) {
    next(error);
  }
});
