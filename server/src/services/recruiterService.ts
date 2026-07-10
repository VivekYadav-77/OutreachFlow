import { format } from "@fast-csv/format";
import { parseString } from "@fast-csv/parse";
import { and, asc, count, desc, eq, ilike, or, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database/db.js";
import { recruiters, emailQueue, emailDrafts } from "../database/schema.js";
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

  // If worker is running, block editing if the recruiter has any active queue jobs
  if (settings.workerStatus === "running") {
    const activeJobs = await db
      .select()
      .from(emailQueue)
      .where(
        and(
          eq(emailQueue.recruiterId, id),
          inArray(emailQueue.state, ["Pending", "Sending", "Retrying"])
        )
      );
    if (activeJobs.length > 0) {
      throw new ValidationError("Cannot edit recruiter info while the worker is actively running and this recruiter has an active job in the queue. Please pause or stop the worker first.");
    }
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
      }
    }
  }

  await createLog({ event: "recruiter.updated", message: `Recruiter updated: ${updated.email}`, recruiterId: id });
  return updated;
}

export async function deleteRecruiter(id: number) {
  await getRecruiter(id);
  const settings = await getSettings();

  // If worker is running, block deleting if the recruiter has any active queue jobs
  if (settings.workerStatus === "running") {
    const activeJobs = await db
      .select()
      .from(emailQueue)
      .where(
        and(
          eq(emailQueue.recruiterId, id),
          inArray(emailQueue.state, ["Pending", "Sending", "Retrying"])
        )
      );
    if (activeJobs.length > 0) {
      throw new ValidationError("Cannot delete recruiter while the worker is actively running and this recruiter has an active job in the queue. Please pause or stop the worker first.");
    }
  }

  // Find all drafts associated with this recruiter's queue jobs to clean them up
  const jobs = await db.select().from(emailQueue).where(eq(emailQueue.recruiterId, id));
  const draftIds = jobs.map((job) => job.draftId).filter((dId): dId is number => dId !== null);

  // Delete the recruiter (cascades to email_queue in the database)
  await db.delete(recruiters).where(eq(recruiters.id, id));

  // Clean up orphaned email drafts
  if (draftIds.length > 0) {
    await db.delete(emailDrafts).where(inArray(emailDrafts.id, draftIds));
  }

  await createLog({ event: "recruiter.deleted", message: "Recruiter deleted", recruiterId: id });
}

type CsvRow = Record<string, string>;

export async function importRecruitersFromCsv(csv: string) {
  const rows = await new Promise<CsvRow[]>((resolve, reject) => {
    const output: CsvRow[] = [];
    parseString(csv, { headers: true, trim: true })
      .on("error", reject)
      .on("data", (row) => output.push(row))
      .on("end", () => resolve(output));
  });

  const required = ["fullName", "company", "email"];
  const defaultTemplate = await getDefaultTemplate().catch(() => null);
  const seen = new Set<string>();
  const summary = { imported: 0, duplicates: 0, invalid: 0, skipped: 0 };

  for (const row of rows) {
    if (!required.every((key) => key in row)) {
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
  await createLog({ event: "recruiter.imported", message: "CSV import completed", metadata: summary });
  return summary;
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
