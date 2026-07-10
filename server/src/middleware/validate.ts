import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../utils/errors.js";

type ValidationTarget = "body" | "query" | "params";

export function validate(target: ValidationTarget, schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(new ValidationError("Invalid request data", result.error.flatten()));
      return;
    }
    Object.defineProperty(req, target, {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true
    });
    next();
  };
}
