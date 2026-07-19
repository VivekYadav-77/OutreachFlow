import { Router } from "express";
import { checkBounces } from "../services/bounceMonitorService.js";
import { checkReplies } from "../services/replyMonitorService.js";

export const emailMonitorRoutes = Router();

emailMonitorRoutes.post("/check-bounces", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await checkBounces() });
  } catch (error) {
    next(error);
  }
});

emailMonitorRoutes.post("/check-replies", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await checkReplies() });
  } catch (error) {
    next(error);
  }
});
