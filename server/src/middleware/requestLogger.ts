import type { NextFunction, Request, Response } from "express";
import { consoleLogger } from "../utils/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  res.on("finish", () => {
    consoleLogger.info({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started }, "request completed");
  });
  next();
}
