import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { listLogs } from "../services/logService.js";

export const logRoutes = Router();

logRoutes.get(
  "/",
  validate("query", z.object({ level: z.enum(["info", "warn", "error"]).optional(), event: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(100) })),
  async (req, res, next) => {
    try {
      res.json({ ok: true, data: await listLogs(req.query as never) });
    } catch (error) {
      next(error);
    }
  }
);
