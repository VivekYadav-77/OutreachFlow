import { Router } from "express";
import { getStatistics } from "../services/statisticsService.js";

export const statisticsRoutes = Router();

statisticsRoutes.get("/", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getStatistics() });
  } catch (error) {
    next(error);
  }
});
