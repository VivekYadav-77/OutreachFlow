import { format } from "@fast-csv/format";
import { parseString } from "@fast-csv/parse";
import { and, asc, count, desc, eq, ilike, or, inArray, ne } from "drizzle-orm";
import * as XLSX from "xlsx";
import { z } from "zod";
import { db } from "../database/db.js";
import { recruiters, emailQueue, emailDrafts, emailDraftAttachments } from "../database/schema.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { createLog } from "./logService.js";
import { getDefaultTemplate, getTemplate, renderTemplate } from "./templateService.js";
import { getSettings } from "./settingsService.js";

export const recruiterSchema = z.object({
  fullName: z.string().min(1),
  company: z.string().min(1),
  designation: z.string().optional().nullable(),
  email: z.string().email().transform((value) => value.toLowerCase()),
  linkedin: z.string().optional().nullable(),
  notes: z.string().optional().default(""),
  status: z.enum(["Pending", "Sent", "Failed", "Replied", "Skipped"]).optional().default("Pending"),
  templateId: z.number().int().positive().optional().nullable()
});

export const recruiterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().optional(),
  status: z.enum(["Pending", "Sent", "Failed", "Replied", "Skipped"]).optional()
});

export async function listRecruiters(query: z.infer<typeof recruiterQuerySchema>) {
  const parsed = recruiterQuerySchema.parse(query);
  const filters = [];
  if (parsed.status) filters.push(eq(recruiters.status, parsed.status));
  if (parsed.search) {
    const term = `%${parsed.search}%`;
    filters.push(or(ilike(recruiters.fullName, term), ilike(recruiters.company, term), ilike(recruiters.email, term), ilike(recruiters.designation, term)));
  }
  const where = filters.length ? and(...filters) : undefined;
  const [{ value: total }] = await db.select({ value: count() }).from(recruiters).where(where);
  const rows = await db
    .select()
    .from(recruiters)
    .where(where)
    .orderBy(desc(recruiters.createdAt))
    .limit(parsed.pageSize)
    .offset((parsed.page - 1) * parsed.pageSize);
  return { rows, total, page: parsed.page, pageSize: parsed.pageSize };
}

export async function getRecruiter(id: number) {
  const [row] = await db.select().from(recruiters).where(eq(recruiters.id, id));
  if (!row) throw new NotFoundError("Recruiter not found");
  return row;
}

export async function createRecruiter(input: z.infer<typeof recruiterSchema>) {
  const parsed = recruiterSchema.parse(input);
  if (!parsed.templateId) {
    throw new ValidationError("Template selection is required to add a recruiter");
  }
  await getTemplate(parsed.templateId);
  const [created] = await db.insert(recruiters).values({ ...parsed, templateId: parsed.templateId }).returning();
  await createLog({ event: "recruiter.created", message: `Recruiter created: ${created.email}`, recruiterId: created.id });
  return created;
}

export async function updateRecruiter(id: number, input: Partial<z.infer<typeof recruiterSchema>>) {
  await getRecruiter(id);
  const settings = await getSettings();

  // Block editing if the recruiter has any queue jobs currently being sent
  const activeJobs = await db
    .select()
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.recruiterId, id),
        eq(emailQueue.state, "Sending")
      )
    );
  if (activeJobs.length > 0) {
    throw new ValidationError("Cannot edit recruiter info while an email is actively being sent to them.");
  }

  const parsed = recruiterSchema.partial().parse(input);
  if (parsed.templateId) await getTemplate(parsed.templateId);
  const [updated] = await db.update(recruiters).set({ ...parsed, updatedAt: new Date() }).where(eq(recruiters.id, id)).returning();

  // Re-generate and synchronize drafts for any non-sent queue jobs associated with this recruiter
  const nonSentJobs = await db
    .select()
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.recruiterId, id),
        ne(emailQueue.state, "Sent")
      )
    );

  for (const job of nonSentJobs) {
    if (job.draftId) {
      const template = updated.templateId
        ? await getTemplate(updated.templateId).catch(() => getDefaultTemplate())
        : await getDefaultTemplate();

      if (template) {
        const rendered = renderTemplate(template, updated);
        await db
          .update(emailDrafts)
          .set({
            to: [updated.email],
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            status: "Queued", // Reset status to Queued in case it failed
            updatedAt: new Date()
          })
          .where(eq(emailDrafts.id, job.draftId));

        // Sync template attachments to regenerated draft
        await db.delete(emailDraftAttachments).where(eq(emailDraftAttachments.draftId, job.draftId));
        if ((template as any).attachments && (template as any).attachments.length > 0) {
          await db.insert(emailDraftAttachments).values(
            (template as any).attachments.map((file: any) => ({
              draftId: job.draftId,
              fileId: file.id
            }))
          );
        }
      }
    }
  }

  await createLog({ event: "recruiter.updated", message: `Recruiter updated: ${updated.email}`, recruiterId: id });
  return updated;
}

export async function deleteRecruiter(id: number) {
  await getRecruiter(id);
  const settings = await getSettings();

  // Block deleting if the recruiter has any queue jobs currently being sent
  const activeJobs = await db
    .select()
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.recruiterId, id),
        eq(emailQueue.state, "Sending")
      )
    );
  if (activeJobs.length > 0) {
    throw new ValidationError("Cannot delete recruiter while an email is actively being sent to them.");
  }

  // Find all drafts associated with this recruiter's queue jobs to clean them up
  const jobs = await db.select().from(emailQueue).where(eq(emailQueue.recruiterId, id));
  const draftIds = jobs.map((job) => job.draftId).filter((dId): dId is number => dId !== null);

  // Log before deleting to avoid FK constraint violation on send_logs.recruiter_id
  await createLog({ event: "recruiter.deleted", message: `Recruiter deleted (id=${id})` });

  // Delete the recruiter (cascades to email_queue in the database)
  await db.delete(recruiters).where(eq(recruiters.id, id));

  // Clean up orphaned email drafts
  if (draftIds.length > 0) {
    await db.delete(emailDrafts).where(inArray(emailDrafts.id, draftIds));
  }
}

export async function deleteDeletableRecruiters() {
  const rows = await db.select({ id: recruiters.id }).from(recruiters);
  if (rows.length === 0) return { deleted: 0, skipped: 0 };

  const sendingJobs = await db
    .select({ recruiterId: emailQueue.recruiterId })
    .from(emailQueue)
    .where(eq(emailQueue.state, "Sending"));

  const blockedIds = new Set(
    sendingJobs
      .map((job) => job.recruiterId)
      .filter((recruiterId): recruiterId is number => recruiterId !== null)
  );

  let deleted = 0;
  let skipped = blockedIds.size;

  for (const row of rows) {
    if (blockedIds.has(row.id)) continue;

    try {
      await deleteRecruiter(row.id);
      deleted += 1;
    } catch (error) {
      if (error instanceof ValidationError) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  await createLog({
    event: "recruiter.bulk_deleted",
    message: `Bulk recruiter delete completed: ${deleted} deleted, ${skipped} skipped`,
    metadata: { deleted, skipped }
  });

  return { deleted, skipped };
}

// Exported so the frontend can show the expected structure as a hint
export const CSV_REQUIRED_COLUMNS = ["fullName", "company", "email"] as const;
export const CSV_OPTIONAL_COLUMNS = ["designation", "linkedin", "notes"] as const;

type CsvRow = Record<string, string>;
type CsvImportError = { row: number; reason: string };
type RecruiterImportField = typeof CSV_REQUIRED_COLUMNS[number] | typeof CSV_OPTIONAL_COLUMNS[number];

const MAX_ROW_ERRORS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD_ALIASES: Record<RecruiterImportField, string[]> = {
  fullName: ["fullName", "full name", "name", "contact name", "candidate name", "hr name"],
  company: ["company", "company name", "organization", "organisation"],
  email: ["email", "email id", "email address", "mail", "mail id"],
  designation: ["designation", "title", "job title", "position", "role"],
  linkedin: ["linkedin", "linkedin url", "profile", "linkedin profile"],
  notes: ["notes", "remarks", "comment", "comments"]
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const NORMALIZED_FIELD_ALIASES = Object.fromEntries(
  Object.entries(FIELD_ALIASES).map(([field, aliases]) => [field, aliases.map(normalizeHeader)])
) as Record<RecruiterImportField, string[]>;

function findFieldForHeader(header: string): RecruiterImportField | undefined {
  const normalized = normalizeHeader(header);
  return (Object.keys(NORMALIZED_FIELD_ALIASES) as RecruiterImportField[]).find((field) => NORMALIZED_FIELD_ALIASES[field].includes(normalized));
}

function findLikelyEmailHeader(rows: CsvRow[], mappedHeaders: Set<string>) {
  const headers = Object.keys(rows[0] ?? {});
  return headers.find((header) => {
    if (mappedHeaders.has(header)) return false;
    const sampledValues = rows.slice(0, 25).map((row) => row[header]?.trim()).filter(Boolean);
    return sampledValues.length > 0 && sampledValues.some((value) => EMAIL_PATTERN.test(value));
  });
}

function normalizeImportRows(rows: CsvRow[], sourceLabel: "CSV" | "Excel") {
  if (rows.length === 0) return rows;

  const headers = Object.keys(rows[0]);
  const mappedHeaders = new Set<string>();
  const fieldToHeader = new Map<RecruiterImportField, string>();

  for (const header of headers) {
    const field = findFieldForHeader(header);
    if (!field || fieldToHeader.has(field)) continue;
    fieldToHeader.set(field, header);
    mappedHeaders.add(header);
  }

  if (!fieldToHeader.has("email")) {
    const emailHeader = findLikelyEmailHeader(rows, mappedHeaders);
    if (emailHeader) {
      fieldToHeader.set("email", emailHeader);
      mappedHeaders.add(emailHeader);
    }
  }

  if (!fieldToHeader.has("notes")) {
    const categoryHeader = headers.find((header) => normalizeHeader(header) === "category");
    if (categoryHeader) fieldToHeader.set("notes", categoryHeader);
  }

  if (!fieldToHeader.has("email")) {
    throw new ValidationError(`${sourceLabel} does not include a recognizable email column. Use a header like email, email id, email address, mail, or mail id.`);
  }
  if (!fieldToHeader.has("fullName") && !fieldToHeader.has("company")) {
    throw new ValidationError(`${sourceLabel} does not include recognizable contact columns. Use headers like name/full name and company/company name.`);
  }

  return rows.map((row) => {
    const normalizedRow: CsvRow = {};
    for (const [field, header] of fieldToHeader) {
      normalizedRow[field] = row[header]?.trim() ?? "";
    }
    return normalizedRow;
  });
}

export async function importRecruitersFromExcel(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return importRecruitersFromRows([], "Excel");

  const sheet = workbook.Sheets[firstSheetName];
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false });
  if (table.length === 0) return importRecruitersFromRows([], "Excel");

  const headers = table[0].map((cell) => String(cell ?? "").trim());
  const rows = table.slice(1).map((cells) => {
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      if (!header) return;
      row[header] = String(cells[index] ?? "").trim();
    });
    return row;
  });

  return importRecruitersFromRows(normalizeImportRows(rows, "Excel"), "Excel");
}

export async function importRecruitersFromRows(rows: CsvRow[], sourceLabel: "CSV" | "Excel" = "CSV") {
  const defaultTemplate = await getDefaultTemplate().catch(() => null);
  const seen = new Set<string>();
  const summary = {
    imported: 0,
    duplicates: 0,
    invalid: 0,
    skipped: 0,
    errors: [] as CsvImportError[]
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    if (!CSV_REQUIRED_COLUMNS.every((key) => key in row && row[key].trim() !== "")) {
      if (summary.errors.length < MAX_ROW_ERRORS) {
        const missing = CSV_REQUIRED_COLUMNS.filter((key) => !(key in row) || row[key].trim() === "");
        summary.errors.push({ row: rowNumber, reason: `Missing required field(s): ${missing.join(", ")}` });
      }
      summary.skipped += 1;
      continue;
    }

    const parsed = recruiterSchema.safeParse({
      fullName: row.fullName,
      company: row.company,
      designation: row.designation || null,
      email: row.email,
      linkedin: row.linkedin || null,
      notes: row.notes || "",
      templateId: defaultTemplate ? defaultTemplate.id : null
    });

    if (!parsed.success) {
      if (summary.errors.length < MAX_ROW_ERRORS) {
        const reason = parsed.error.issues[0]?.message ?? "Validation failed";
        summary.errors.push({ row: rowNumber, reason });
      }
      summary.invalid += 1;
      continue;
    }

    if (seen.has(parsed.data.email)) {
      summary.duplicates += 1;
      continue;
    }
    seen.add(parsed.data.email);

    try {
      await db.insert(recruiters).values({ ...parsed.data, templateId: defaultTemplate ? defaultTemplate.id : null });
      summary.imported += 1;
    } catch {
      summary.duplicates += 1;
    }
  }

  await createLog({ event: "recruiter.imported", message: `${sourceLabel} import completed`, metadata: { imported: summary.imported, duplicates: summary.duplicates, invalid: summary.invalid, skipped: summary.skipped } });
  return summary;
}

export async function importRecruitersFromCsv(csv: string) {
  const rows = await new Promise<CsvRow[]>((resolve, reject) => {
    const output: CsvRow[] = [];
    parseString(csv, { headers: true, trim: true })
      .on("error", reject)
      .on("data", (row) => output.push(row))
      .on("end", () => resolve(output));
  });
  return importRecruitersFromRows(normalizeImportRows(rows, "CSV"), "CSV");
}

export async function exportRecruitersCsv() {
  const rows = await db.select().from(recruiters).orderBy(asc(recruiters.createdAt));
  return new Promise<string>((resolve, reject) => {
    let csv = "";
    const stream = format({ headers: true });
    stream.on("error", reject).on("data", (chunk) => {
      csv += chunk.toString();
    });
    stream.on("end", () => resolve(csv));
    rows.forEach((row) => stream.write(row));
    stream.end();
  });
}
