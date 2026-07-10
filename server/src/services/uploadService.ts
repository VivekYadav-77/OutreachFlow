import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../database/db.js";
import { uploadedFiles } from "../database/schema.js";
import { ValidationError } from "../utils/errors.js";
import { createLog } from "./logService.js";

const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

export async function saveResume(file: Express.Multer.File) {
  if (file.mimetype !== "application/pdf") throw new ValidationError("Resume must be a PDF");
  if (file.size > MAX_RESUME_SIZE) throw new ValidationError("Resume PDF must be 10MB or smaller");

  await fs.mkdir(config.uploadsDir, { recursive: true });
  const storedName = `resume-${Date.now()}.pdf`;
  const destination = path.join(config.uploadsDir, storedName);
  await fs.rename(file.path, destination);

  await db.update(uploadedFiles).set({ active: false }).where(eq(uploadedFiles.active, true));
  const [created] = await db
    .insert(uploadedFiles)
    .values({
      originalName: path.basename(file.originalname),
      storedName,
      path: destination,
      mimeType: file.mimetype,
      size: file.size,
      kind: "resume",
      active: true
    })
    .returning();
  await createLog({ event: "resume.uploaded", message: "Resume PDF uploaded", metadata: { fileId: created.id } });
  return created;
}

export async function getActiveResume() {
  const [file] = await db.select().from(uploadedFiles).where(and(eq(uploadedFiles.active, true), eq(uploadedFiles.kind, "resume"))).limit(1);
  return file;
}

export async function saveAttachment(file: Express.Multer.File) {
  if (file.size > MAX_ATTACHMENT_SIZE) throw new ValidationError("Attachment must be 25MB or smaller");

  await fs.mkdir(config.uploadsDir, { recursive: true });
  const extension = path.extname(file.originalname);
  const storedName = `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
  const destination = path.join(config.uploadsDir, storedName);
  await fs.rename(file.path, destination);

  const [created] = await db
    .insert(uploadedFiles)
    .values({
      originalName: path.basename(file.originalname),
      storedName,
      path: destination,
      mimeType: file.mimetype || "application/octet-stream",
      size: file.size,
      kind: "attachment",
      active: true
    })
    .returning();
  await createLog({ event: "attachment.uploaded", message: `Attachment uploaded: ${created.originalName}`, metadata: { fileId: created.id } });
  return created;
}
