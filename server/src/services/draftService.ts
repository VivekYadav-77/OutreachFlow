import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database/db.js";
import { emailDraftAttachments, emailDrafts, emailQueue, uploadedFiles } from "../database/schema.js";
import type { BuiltEmail } from "../providers/emailProvider.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { createLog } from "./logService.js";

const emailAddressSchema = z.string().trim().email().transform((value) => value.toLowerCase());
const recipientListSchema = z.array(emailAddressSchema).default([]);

export const draftSchema = z.object({
  to: recipientListSchema.optional(),
  cc: recipientListSchema.optional(),
  bcc: recipientListSchema.optional(),
  subject: z.string().max(998).optional().default(""),
  html: z.string().optional().default(""),
  text: z.string().optional().default(""),
  attachmentIds: z.array(z.coerce.number().int().positive()).optional()
});

function isBlankBody(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}

function normalizeDraft(input: z.input<typeof draftSchema>) {
  const parsed = draftSchema.parse(input);
  return {
    to: parsed.to ?? [],
    cc: parsed.cc ?? [],
    bcc: parsed.bcc ?? [],
    subject: parsed.subject ?? "",
    html: parsed.html ?? "",
    text: parsed.text ?? "",
    attachmentIds: parsed.attachmentIds ?? []
  };
}

async function assertAttachmentIds(attachmentIds: number[]) {
  if (attachmentIds.length === 0) return [];
  const files = await db.select().from(uploadedFiles).where(and(inArray(uploadedFiles.id, attachmentIds), eq(uploadedFiles.kind, "attachment")));
  if (files.length !== new Set(attachmentIds).size) throw new ValidationError("One or more attachments are invalid");
  return files;
}

async function replaceAttachments(draftId: number, attachmentIds: number[]) {
  await assertAttachmentIds(attachmentIds);
  await db.delete(emailDraftAttachments).where(eq(emailDraftAttachments.draftId, draftId));
  if (attachmentIds.length > 0) {
    await db.insert(emailDraftAttachments).values(attachmentIds.map((fileId) => ({ draftId, fileId })));
  }
}

export async function listDrafts() {
  return db.select().from(emailDrafts).orderBy(desc(emailDrafts.updatedAt));
}

export async function getDraft(id: number) {
  const [draft] = await db.select().from(emailDrafts).where(eq(emailDrafts.id, id));
  if (!draft) throw new NotFoundError("Draft not found");
  const attachments = await db
    .select({
      id: uploadedFiles.id,
      originalName: uploadedFiles.originalName,
      mimeType: uploadedFiles.mimeType,
      size: uploadedFiles.size,
      createdAt: uploadedFiles.createdAt
    })
    .from(emailDraftAttachments)
    .innerJoin(uploadedFiles, eq(emailDraftAttachments.fileId, uploadedFiles.id))
    .where(eq(emailDraftAttachments.draftId, id));
  return { ...draft, attachments };
}

export async function createDraft(input: z.input<typeof draftSchema>) {
  const parsed = normalizeDraft(input);
  await assertAttachmentIds(parsed.attachmentIds);
  const [created] = await db
    .insert(emailDrafts)
    .values({
      to: parsed.to,
      cc: parsed.cc,
      bcc: parsed.bcc,
      subject: parsed.subject,
      html: parsed.html,
      text: parsed.text
    })
    .returning();
  await replaceAttachments(created.id, parsed.attachmentIds);
  await createLog({ event: "draft.created", message: "Email draft created", metadata: { draftId: created.id } });
  return getDraft(created.id);
}

export async function updateDraft(id: number, input: z.input<typeof draftSchema>) {
  const current = await getDraft(id);
  if (current.status !== "Draft") throw new ValidationError("Only draft emails can be edited");
  const parsed = normalizeDraft(input);
  await db
    .update(emailDrafts)
    .set({
      to: parsed.to,
      cc: parsed.cc,
      bcc: parsed.bcc,
      subject: parsed.subject,
      html: parsed.html,
      text: parsed.text,
      updatedAt: new Date()
    })
    .where(eq(emailDrafts.id, id));
  await replaceAttachments(id, parsed.attachmentIds);
  await createLog({ event: "draft.saved", message: "Email draft saved", metadata: { draftId: id } });
  return getDraft(id);
}

export async function deleteDraft(id: number) {
  const draft = await getDraft(id);
  if (!["Draft", "Failed"].includes(draft.status)) throw new ValidationError("Queued or sent emails cannot be deleted");
  await db.delete(emailDrafts).where(eq(emailDrafts.id, id));
  await createLog({ event: "draft.deleted", message: "Email draft deleted", metadata: { draftId: id } });
}

export async function validateDraftForQueue(id: number, allowEmptySubject = false) {
  const draft = await getDraft(id);
  if (draft.status !== "Draft" && draft.status !== "Failed") throw new ValidationError("Only draft or failed emails can be queued");
  if (draft.to.length === 0) throw new ValidationError("At least one To recipient is required");
  if (!draft.subject.trim() && !allowEmptySubject) throw new ValidationError("Subject is required before queueing");
  if (isBlankBody(draft.html) && draft.attachments.length === 0) throw new ValidationError("Email body or at least one attachment is required");
  return draft;
}

export async function queueDraft(id: number, options: { allowEmptySubject?: boolean } = {}) {
  const draft = await validateDraftForQueue(id, options.allowEmptySubject);
  const [job] = await db.insert(emailQueue).values({ draftId: id }).returning();
  await db
    .update(emailDrafts)
    .set({ status: "Queued", lastError: null, queuedAt: new Date(), updatedAt: new Date() })
    .where(eq(emailDrafts.id, id));
  await createLog({ event: "draft.queued", message: `Draft queued for ${draft.to.join(", ")}`, queueId: job.id, metadata: { draftId: id } });
  return { draft: await getDraft(id), job };
}

export async function getComposedEmailWithAttachments(draftId: number): Promise<BuiltEmail> {
  const draft = await getDraft(draftId);
  const files = await db
    .select()
    .from(emailDraftAttachments)
    .innerJoin(uploadedFiles, eq(emailDraftAttachments.fileId, uploadedFiles.id))
    .where(eq(emailDraftAttachments.draftId, draftId));
  return {
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    subject: draft.subject,
    html: draft.html,
    text: draft.text || draft.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    attachments: files.map(({ uploaded_files: file }) => ({
      path: file.path,
      originalName: file.originalName,
      mimeType: file.mimeType
    }))
  };
}

export async function markDraftSending(id: number) {
  await db.update(emailDrafts).set({ status: "Sending", updatedAt: new Date() }).where(eq(emailDrafts.id, id));
}

export async function markDraftSent(id: number, gmailMessageId?: string, gmailThreadId?: string) {
  await db
    .update(emailDrafts)
    .set({ status: "Sent", gmailMessageId, gmailThreadId, sentAt: new Date(), lastError: null, updatedAt: new Date() })
    .where(eq(emailDrafts.id, id));
}

export async function markDraftFailed(id: number, message: string) {
  await db.update(emailDrafts).set({ status: "Failed", lastError: message, updatedAt: new Date() }).where(eq(emailDrafts.id, id));
}
