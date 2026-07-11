import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { getActiveResume } from "../services/uploadService.js";
import { parsePdf } from "../utils/pdfParser.js";
import { generateCoverLetter } from "../services/geminiService.js";
import { ValidationError } from "../utils/errors.js";

export const coverLetterRoutes = Router();

const generateSchema = z.object({
  role: z.string().min(1, "Target role is required"),
  company: z.string().min(1, "Target company is required"),
  tone: z.string().min(1, "Tone/style is required"),
  jobDescription: z.string().optional(),
  focusSkills: z.array(z.string()).optional()
});

coverLetterRoutes.post("/generate", validate("body", generateSchema), async (req, res, next) => {
  try {
    const activeResume = await getActiveResume();
    if (!activeResume) {
      throw new ValidationError("No active resume PDF found. Please upload a resume first.");
    }

    // Extract text from the active resume PDF
    let resumeText: string;
    try {
      resumeText = await parsePdf(activeResume.path);
    } catch (parseErr) {
      throw new ValidationError(`Failed to parse the resume PDF: ${(parseErr as Error).message}`);
    }

    const { role, company, tone, jobDescription, focusSkills } = req.body;

    const result = await generateCoverLetter({
      resumeText,
      role,
      company,
      tone,
      jobDescription,
      focusSkills
    });

    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
});
