import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { validate } from "../middleware/validate.js";
import {
  createRecruiter,
  deleteDeletableRecruiters,
  deleteRecruiter,
  exportRecruitersCsv,
  getRecruiter,
  importRecruitersFromCsv,
  importRecruitersFromExcel,
  listRecruiters,
  recruiterQuerySchema,
  recruiterSchema,
  updateRecruiter
} from "../services/recruiterService.js";
import { ValidationError } from "../utils/errors.js";

const upload = multer({ dest: config.uploadsDir, limits: { fileSize: 5 * 1024 * 1024 } });
export const recruiterRoutes = Router();

function isCsvFile(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).toLowerCase();
  return extension === ".csv" || file.mimetype === "text/csv" || file.mimetype === "application/csv";
}

function isExcelFile(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).toLowerCase();
  return (
    extension === ".xlsx" ||
    extension === ".xls" ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimetype === "application/vnd.ms-excel"
  );
}

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
    if (!req.file) throw new ValidationError("CSV or Excel file is required");
    if (isCsvFile(req.file)) {
      const csv = await fs.readFile(req.file.path, "utf8");
      res.json({ ok: true, data: await importRecruitersFromCsv(csv) });
      return;
    }
    if (isExcelFile(req.file)) {
      const workbook = await fs.readFile(req.file.path);
      res.json({ ok: true, data: await importRecruitersFromExcel(workbook) });
      return;
    }
    throw new ValidationError("Please upload a CSV or Excel file");
  } catch (error) {
    next(error);
  } finally {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => undefined);
    }
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

recruiterRoutes.delete("/bulk/deletable", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await deleteDeletableRecruiters() });
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
