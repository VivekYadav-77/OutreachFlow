import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { consoleLogger, logger } from "../utils/logger.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    logger.warn({ code: error.code, details: error.details }, error.message);
    res.status(error.statusCode).json({ ok: false, error: { code: error.code, message: error.message, details: error.details } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request data", details: error.flatten() } });
    return;
  }

  logger.error({ error }, "Unhandled error");
  consoleLogger.error(error);
  res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
}
