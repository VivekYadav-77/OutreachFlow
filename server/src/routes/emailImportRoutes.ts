import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { importSentEmails } from "../services/gmailImportService.js";

const sentImportSchema = z.object({
  maxMessages: z.coerce.number().int().min(1).max(1000).optional()
});

export const emailImportRoutes = Router();

emailImportRoutes.post("/sent", validate("body", sentImportSchema), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await importSentEmails(req.body.maxMessages) });
  } catch (error) {
    next(error);
  }
});
