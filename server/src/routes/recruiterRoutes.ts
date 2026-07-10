import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { validate } from "../middleware/validate.js";
import {
  createRecruiter,
  deleteRecruiter,
  exportRecruitersCsv,
  getRecruiter,
  importRecruitersFromCsv,
  listRecruiters,
  recruiterQuerySchema,
  recruiterSchema,
  updateRecruiter
} from "../services/recruiterService.js";
import { ValidationError } from "../utils/errors.js";

const upload = multer({ dest: config.uploadsDir, limits: { fileSize: 5 * 1024 * 1024 } });
export const recruiterRoutes = Router();

recruiterRoutes.get("/", validate("query", recruiterQuerySchema), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await listRecruiters(req.query as never) });
  } catch (error) {
    next(error);
  }
});

recruiterRoutes.get("/export", async (_req, res, next) => {
  try {
    const csv = await exportRecruitersCsv();
    res.header("Content-Type", "text/csv");
    res.attachment("recruiters.csv");
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

recruiterRoutes.post("/import", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new ValidationError("CSV file is required");
    const csv = await import("node:fs/promises").then((fs) => fs.readFile(req.file!.path, "utf8"));
    res.json({ ok: true, data: await importRecruitersFromCsv(csv) });
  } catch (error) {
    next(error);
  }
});

recruiterRoutes.get("/:id", validate("params", z.object({ id: z.coerce.number().int().positive() })), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await getRecruiter(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

recruiterRoutes.post("/", validate("body", recruiterSchema), async (req, res, next) => {
  try {
    res.status(201).json({ ok: true, data: await createRecruiter(req.body) });
  } catch (error) {
    next(error);
  }
});

recruiterRoutes.put("/:id", validate("params", z.object({ id: z.coerce.number().int().positive() })), validate("body", recruiterSchema.partial()), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await updateRecruiter(Number(req.params.id), req.body) });
  } catch (error) {
    next(error);
  }
});

recruiterRoutes.delete("/:id", validate("params", z.object({ id: z.coerce.number().int().positive() })), async (req, res, next) => {
  try {
    await deleteRecruiter(Number(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
