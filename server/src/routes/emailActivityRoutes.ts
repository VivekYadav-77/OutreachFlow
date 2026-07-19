import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { exportEmailActivities, getEmailActivitySummary, listEmailActivities } from "../services/emailActivityService.js";

const activityQuerySchema = z.object({
  type: z.enum(["all", "replies", "bounces", "imports"]).optional().default("all"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  search: z.string().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fromTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  toTime: z.string().regex(/^\d{2}:\d{2}$/).optional()
});

const exportQuerySchema = activityQuerySchema.omit({ page: true, pageSize: true }).extend({
  exportMode: z.enum(["all", "withoutBounces"]).optional().default("all")
});

export const emailActivityRoutes = Router();

emailActivityRoutes.get("/summary", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getEmailActivitySummary() });
  } catch (error) {
    next(error);
  }
});

emailActivityRoutes.get("/export", validate("query", exportQuerySchema), async (req, res, next) => {
  try {
    const exported = await exportEmailActivities(req.query as never);
    res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.header("Content-Disposition", `attachment; filename="${exported.filename}"`);
    res.header("X-Exported-Row-Count", String(exported.count));
    res.send(exported.buffer);
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
