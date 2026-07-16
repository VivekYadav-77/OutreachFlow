import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getAuthStatus, getGoogleAuthUrl, handleGoogleCallback } from "../auth/googleAuth.js";
import { validate } from "../middleware/validate.js";
import { markGoogleConnecting } from "../services/oauthConnectionService.js";
import { emailWorker } from "../workers/emailWorker.js";

export const authRoutes = Router();

authRoutes.get("/google", async (_req, res, next) => {
  try {
    await markGoogleConnecting();
    res.redirect(getGoogleAuthUrl());
  } catch (error) {
    next(error);
  }
});

authRoutes.get("/callback", validate("query", z.object({ code: z.string().min(1) })), async (req, res, next) => {
  try {
    const resumed = await handleGoogleCallback(String(req.query.code));
    if (resumed.resumedJobs > 0) {
      await emailWorker.start();
    }
    res.redirect(`${config.CLIENT_URL}/settings?auth=connected`);
  } catch (error) {
    console.error("CALLBACK ERROR:", error);
    next(error);
  }
});

authRoutes.get("/status", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getAuthStatus() });
  } catch (error) {
    next(error);
  }
});
