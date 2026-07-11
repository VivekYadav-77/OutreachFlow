import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { listLogs } from "../services/logService.js";

export const logRoutes = Router();

logRoutes.get(
  "/",
  validate(
    "query",
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(500).default(25),
      level: z.enum(["info", "warn", "error"]).optional(),
      event: z.string().optional(),
      search: z.string().optional()
    })
  ),
  async (req, res, next) => {
    try {
      res.json({ ok: true, data: await listLogs(req.query as never) });
    } catch (error) {
      next(error);
    }
  }
);
