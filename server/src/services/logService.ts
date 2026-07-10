import { desc, eq } from "drizzle-orm";
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

export async function listLogs(options: { level?: LogLevel; event?: string; limit?: number }) {
  const rows = await db.select().from(sendLogs).orderBy(desc(sendLogs.createdAt)).limit(options.limit ?? 100);
  return rows.filter((row) => (!options.level || row.level === options.level) && (!options.event || row.event.includes(options.event)));
}
