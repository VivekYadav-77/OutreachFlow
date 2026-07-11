import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../database/db.js";
import { sendLogs } from "../database/schema.js";
import { logger } from "../utils/logger.js";

export type LogLevel = "info" | "warn" | "error";

export async function createLog(input: {
  level?: LogLevel;
  event: string;
  message: string;
  recruiterId?: number;
  queueId?: number;
  metadata?: Record<string, unknown>;
}) {
  const level = input.level ?? "info";
  logger[level]({ event: input.event, metadata: input.metadata }, input.message);
  await db.insert(sendLogs).values({
    level,
    event: input.event,
    message: input.message,
    recruiterId: input.recruiterId,
    queueId: input.queueId,
    metadata: input.metadata ?? {}
  });
}

export async function listLogs(options: {
  page?: number;
  limit?: number;
  level?: LogLevel;
  event?: string;
  search?: string;
}) {
  const page = options.page ?? 1;
  const limit = options.limit ?? 50;
  const offset = (page - 1) * limit;

  const filters = [];
  if (options.level) {
    filters.push(eq(sendLogs.level, options.level));
  }
  if (options.event) {
    filters.push(eq(sendLogs.event, options.event));
  }
  if (options.search) {
    const term = `%${options.search}%`;
    filters.push(
      or(
        ilike(sendLogs.event, term),
        ilike(sendLogs.message, term)
      )
    );
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  // Get total matching count
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(sendLogs)
    .where(where);

  // Get current page rows
  const rows = await db
    .select()
    .from(sendLogs)
    .where(where)
    .orderBy(desc(sendLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const totalPages = Math.ceil(total / limit);

  return {
    rows,
    total,
    page,
    limit,
    totalPages
  };
}
