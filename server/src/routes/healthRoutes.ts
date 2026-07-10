import { Router } from "express";
import { pool } from "../database/db.js";

export const healthRoutes = Router();

healthRoutes.get("/", async (_req, res, next) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true, data: { status: "healthy", database: "connected" } });
  } catch (error) {
    next(error);
  }
});
