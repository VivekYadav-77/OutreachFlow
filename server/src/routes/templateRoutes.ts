import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { createTemplate, deleteTemplate, getDefaultTemplate, getTemplate, listTemplates, setDefaultTemplate, templateSchema, updateTemplate } from "../services/templateService.js";

export const templateRoutes = Router();

const idParams = z.object({ id: z.coerce.number().int().positive() });

templateRoutes.get("/", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await listTemplates() });
  } catch (error) {
    next(error);
  }
});

templateRoutes.get("/default", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getDefaultTemplate() });
  } catch (error) {
    next(error);
  }
});

templateRoutes.get("/:id", validate("params", idParams), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await getTemplate(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

templateRoutes.post("/", validate("body", templateSchema), async (req, res, next) => {
  try {
    res.status(201).json({ ok: true, data: await createTemplate(req.body) });
  } catch (error) {
    next(error);
  }
});

templateRoutes.put("/:id", validate("params", idParams), validate("body", templateSchema.partial()), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await updateTemplate(Number(req.params.id), req.body) });
  } catch (error) {
    next(error);
  }
});

templateRoutes.post("/:id/default", validate("params", idParams), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await setDefaultTemplate(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

templateRoutes.delete("/:id", validate("params", idParams), async (req, res, next) => {
  try {
    await deleteTemplate(Number(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
