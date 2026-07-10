import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { createDraft, deleteDraft, draftSchema, getDraft, listDrafts, queueDraft, updateDraft } from "../services/draftService.js";

export const draftRoutes = Router();

const idParams = z.object({ id: z.coerce.number().int().positive() });

draftRoutes.get("/", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await listDrafts() });
  } catch (error) {
    next(error);
  }
});

draftRoutes.get("/:id", validate("params", idParams), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await getDraft(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

draftRoutes.post("/", validate("body", draftSchema), async (req, res, next) => {
  try {
    res.status(201).json({ ok: true, data: await createDraft(req.body) });
  } catch (error) {
    next(error);
  }
});

draftRoutes.put("/:id", validate("params", idParams), validate("body", draftSchema), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await updateDraft(Number(req.params.id), req.body) });
  } catch (error) {
    next(error);
  }
});

draftRoutes.post("/:id/queue", validate("params", idParams), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await queueDraft(Number(req.params.id), { allowEmptySubject: Boolean(req.body?.allowEmptySubject) }) });
  } catch (error) {
    next(error);
  }
});

draftRoutes.delete("/:id", validate("params", idParams), async (req, res, next) => {
  try {
    await deleteDraft(Number(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
