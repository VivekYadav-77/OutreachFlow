import { and, desc, eq, ne, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database/db.js";
import { emailTemplates, recruiters, emailTemplateAttachments, uploadedFiles } from "../database/schema.js";
import type { EmailTemplate, Recruiter } from "../database/schema.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { createLog } from "./logService.js";

export const templateSchema = z.object({
  name: z.string().trim().min(1),
  subjectTemplate: z.string().trim().min(1),
  htmlTemplate: z.string().min(1),
  textTemplate: z.string().optional(),
  isDefault: z.boolean().optional(),
  attachmentIds: z.array(z.coerce.number().int().positive()).optional()
});

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function placeholderValues(recruiter: Pick<Recruiter, "fullName" | "company" | "designation">, escape: (value: string) => string) {
  return {
    fullName: escape(recruiter.fullName),
    company: escape(recruiter.company),
    designation: escape(recruiter.designation?.trim() || "Recruiter")
  };
}

function replaceSupportedPlaceholders(input: string, values: Record<string, string>) {
  return input.replace(/{{\s*(fullName|company|designation)\s*}}/g, (_match, key: string) => values[key] ?? _match);
}

function normalizeTemplate(input: z.infer<typeof templateSchema>) {
  const parsed = templateSchema.parse(input);
  return {
    name: parsed.name,
    subjectTemplate: parsed.subjectTemplate,
    htmlTemplate: parsed.htmlTemplate,
    textTemplate: parsed.textTemplate?.trim() || htmlToText(parsed.htmlTemplate),
    isDefault: parsed.isDefault ?? false
  };
}

async function assertAttachmentIds(attachmentIds: number[]) {
  if (attachmentIds.length === 0) return [];
  const files = await db.select().from(uploadedFiles).where(and(inArray(uploadedFiles.id, attachmentIds), eq(uploadedFiles.kind, "attachment")));
  if (files.length !== new Set(attachmentIds).size) throw new ValidationError("One or more attachments are invalid");
  return files;
}

async function replaceTemplateAttachments(templateId: number, attachmentIds: number[]) {
  await assertAttachmentIds(attachmentIds);
  await db.delete(emailTemplateAttachments).where(eq(emailTemplateAttachments.templateId, templateId));
  if (attachmentIds.length > 0) {
    await db.insert(emailTemplateAttachments).values(attachmentIds.map((fileId) => ({ templateId, fileId })));
  }
}

export async function listTemplates() {
  const templates = await db.select().from(emailTemplates).orderBy(desc(emailTemplates.isDefault), desc(emailTemplates.updatedAt));
  const result = [];
  for (const template of templates) {
    const attachments = await db
      .select({
        id: uploadedFiles.id,
        originalName: uploadedFiles.originalName,
        mimeType: uploadedFiles.mimeType,
        size: uploadedFiles.size,
        createdAt: uploadedFiles.createdAt
      })
      .from(emailTemplateAttachments)
      .innerJoin(uploadedFiles, eq(emailTemplateAttachments.fileId, uploadedFiles.id))
      .where(eq(emailTemplateAttachments.templateId, template.id));
    result.push({ ...template, attachments });
  }
  return result;
}

export async function getTemplate(id: number) {
  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
  if (!template) throw new NotFoundError("Template not found");
  const attachments = await db
    .select({
      id: uploadedFiles.id,
      originalName: uploadedFiles.originalName,
      mimeType: uploadedFiles.mimeType,
      size: uploadedFiles.size,
      createdAt: uploadedFiles.createdAt
    })
    .from(emailTemplateAttachments)
    .innerJoin(uploadedFiles, eq(emailTemplateAttachments.fileId, uploadedFiles.id))
    .where(eq(emailTemplateAttachments.templateId, id));
  return { ...template, attachments };
}

export async function getDefaultTemplate() {
  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.isDefault, true)).limit(1);
  if (!template) throw new ValidationError("No default template exists. Create a template before starting the queue.");
  const attachments = await db
    .select({
      id: uploadedFiles.id,
      originalName: uploadedFiles.originalName,
      mimeType: uploadedFiles.mimeType,
      size: uploadedFiles.size,
      createdAt: uploadedFiles.createdAt
    })
    .from(emailTemplateAttachments)
    .innerJoin(uploadedFiles, eq(emailTemplateAttachments.fileId, uploadedFiles.id))
    .where(eq(emailTemplateAttachments.templateId, template.id));
  return { ...template, attachments };
}

async function ensureOneDefault(preferredId?: number) {
  const rows = await listTemplates();
  if (rows.length === 0) return;
  const chosen = preferredId ? rows.find((row) => row.id === preferredId) : rows.find((row) => row.isDefault) ?? rows[0];
  if (!chosen) return;
  await db.update(emailTemplates).set({ isDefault: false, updatedAt: new Date() }).where(ne(emailTemplates.id, chosen.id));
  await db.update(emailTemplates).set({ isDefault: true, updatedAt: new Date() }).where(eq(emailTemplates.id, chosen.id));
}

export async function createTemplate(input: z.infer<typeof templateSchema>) {
  const parsed = normalizeTemplate(input);
  const attachmentIds = input.attachmentIds ?? [];
  await assertAttachmentIds(attachmentIds);
  const existing = await db.select().from(emailTemplates).limit(1);
  const shouldDefault = parsed.isDefault || existing.length === 0;
  const [created] = await db
    .insert(emailTemplates)
    .values({ ...parsed, isDefault: shouldDefault })
    .returning();
  await replaceTemplateAttachments(created.id, attachmentIds);
  if (shouldDefault) await ensureOneDefault(created.id);
  await createLog({ event: "template.created", message: `Template created: ${created.name}`, metadata: { templateId: created.id } });
  return getTemplate(created.id);
}

export async function updateTemplate(id: number, input: Partial<z.infer<typeof templateSchema>>) {
  await getTemplate(id);
  const parsed = templateSchema.partial().parse(input);
  const attachmentIds = parsed.attachmentIds;
  const values = {
    name: parsed.name,
    subjectTemplate: parsed.subjectTemplate,
    htmlTemplate: parsed.htmlTemplate,
    textTemplate: parsed.textTemplate?.trim() || (parsed.htmlTemplate ? htmlToText(parsed.htmlTemplate) : undefined),
    isDefault: parsed.isDefault,
    updatedAt: new Date()
  };
  const [updated] = await db.update(emailTemplates).set(values).where(eq(emailTemplates.id, id)).returning();
  if (attachmentIds !== undefined) {
    await replaceTemplateAttachments(id, attachmentIds);
  }
  if (parsed.isDefault) await ensureOneDefault(id);
  await createLog({ event: "template.updated", message: `Template updated: ${updated.name}`, metadata: { templateId: id } });
  return getTemplate(id);
}

export async function setDefaultTemplate(id: number) {
  await getTemplate(id);
  await ensureOneDefault(id);
  await createLog({ event: "template.default_set", message: "Default template changed", metadata: { templateId: id } });
  return getTemplate(id);
}

export async function deleteTemplate(id: number) {
  const template = await getTemplate(id);
  const all = await listTemplates();
  if (all.length <= 1) throw new ValidationError("At least one template is required");
  await db.update(recruiters).set({ templateId: null, updatedAt: new Date() }).where(eq(recruiters.templateId, id));
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  if (template.isDefault) {
    const [replacement] = await db.select().from(emailTemplates).orderBy(desc(emailTemplates.updatedAt)).limit(1);
    if (replacement) await ensureOneDefault(replacement.id);
  } else {
    await ensureOneDefault();
  }
  await createLog({ event: "template.deleted", message: "Template deleted", metadata: { templateId: id } });
}

export function renderTemplate(template: Pick<EmailTemplate, "subjectTemplate" | "htmlTemplate" | "textTemplate">, recruiter: Pick<Recruiter, "fullName" | "company" | "designation">) {
  return {
    subject: replaceSupportedPlaceholders(template.subjectTemplate, placeholderValues(recruiter, (value) => value)),
    html: replaceSupportedPlaceholders(template.htmlTemplate, placeholderValues(recruiter, escapeHtml)),
    text: replaceSupportedPlaceholders(template.textTemplate, placeholderValues(recruiter, (value) => value))
  };
}
