import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database/db.js";
import { settings } from "../database/schema.js";
import { ValidationError } from "../utils/errors.js";
import { createLog } from "./logService.js";

export const settingsSchema = z
  .object({
    dailyLimit: z.coerce.number().int().min(1).max(2000).optional(),
    minDelaySeconds: z.coerce.number().int().min(1).optional(),
    maxDelaySeconds: z.coerce.number().int().min(1).optional(),
    startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
    endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
    retryCount: z.coerce.number().int().min(0).max(10).optional(),
    retryIntervalsMinutes: z.array(z.coerce.number().int().min(1)).optional(),
    attachmentEnabled: z.coerce.boolean().optional(),
    workerStatus: z.enum(["stopped", "running", "paused"]).optional()
  })
  .refine((value) => {
    if (value.minDelaySeconds && value.maxDelaySeconds) return value.minDelaySeconds <= value.maxDelaySeconds;
    return true;
  }, "Minimum delay must be less than or equal to maximum delay")
  .refine((value) => {
    if (value.startTime && value.endTime) return timeToMinutes(value.startTime) < timeToMinutes(value.endTime);
    return true;
  }, "Send start time must be before send end time");

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function getSettings() {
  const [row] = await db.select().from(settings).limit(1);
  if (!row) {
    const [created] = await db.insert(settings).values({}).returning();
    return created;
  }
  return row;
}

export async function updateSettings(input: z.infer<typeof settingsSchema>) {
  const parsed = settingsSchema.parse(input);
  const current = await getSettings();
  const nextMin = parsed.minDelaySeconds ?? current.minDelaySeconds;
  const nextMax = parsed.maxDelaySeconds ?? current.maxDelaySeconds;
  if (nextMin > nextMax) throw new ValidationError("Minimum delay must be less than or equal to maximum delay");
  const nextStartTime = parsed.startTime ?? current.startTime;
  const nextEndTime = parsed.endTime ?? current.endTime;
  if (timeToMinutes(nextStartTime) >= timeToMinutes(nextEndTime)) {
    throw new ValidationError("Send start time must be before send end time");
  }
  if (parsed.retryIntervalsMinutes && parsed.retryIntervalsMinutes.length === 0) {
    throw new ValidationError("At least one retry interval is required");
  }

  const [updated] = await db
    .update(settings)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(settings.id, current.id))
    .returning();
  await createLog({ event: "settings.updated", message: "Settings updated", metadata: parsed });
  return updated;
}

export async function setWorkerStatus(workerStatus: "stopped" | "running" | "paused") {
  const current = await getSettings();
  const [updated] = await db.update(settings).set({ workerStatus, updatedAt: new Date() }).where(eq(settings.id, current.id)).returning();
  return updated;
}
