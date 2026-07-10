import { Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { saveAttachment, saveResume } from "../services/uploadService.js";
import { ValidationError } from "../utils/errors.js";

const upload = multer({ dest: config.uploadsDir, limits: { fileSize: 25 * 1024 * 1024 } });
export const uploadRoutes = Router();

uploadRoutes.post("/resume", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new ValidationError("Resume PDF file is required");
    res.status(201).json({ ok: true, data: await saveResume(req.file) });
  } catch (error) {
    next(error);
  }
});

uploadRoutes.post("/attachments", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new ValidationError("Attachment file is required");
    res.status(201).json({ ok: true, data: await saveAttachment(req.file) });
  } catch (error) {
    next(error);
  }
});
