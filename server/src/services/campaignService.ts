import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database/db.js";
import { campaignRecipients, campaigns, emailQueue, recruiters } from "../database/schema.js";
import { NotFoundError } from "../utils/errors.js";
import { createLog } from "./logService.js";
import { getSettings } from "./settingsService.js";

export const campaignSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional().default(""),
    status: z.enum(["Draft", "Scheduled", "Running", "Paused", "PAUSED_AUTH", "Completed", "Cancelled"]).optional().default("Draft"),
    resumeFileId: z.number().int().positive().nullable().optional(),
    dailyLimit: z.number().int().min(1).optional(),
    minDelaySeconds: z.number().int().min(1).optional(),
    maxDelaySeconds: z.number().int().min(1).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    retryCount: z.number().int().min(0).max(10).optional(),
    retryIntervalsMinutes: z.array(z.number().int().min(1)).optional(),
    attachmentEnabled: z.boolean().optional()
  })
  .refine((value) => {
    if (value.minDelaySeconds && value.maxDelaySeconds) return value.minDelaySeconds <= value.maxDelaySeconds;
    return true;
  }, "Minimum delay must be less than or equal to maximum delay");

export async function getCampaign(id: number) {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (!campaign) throw new NotFoundError("Campaign not found");
  return campaign;
}

export async function getOrCreateDefaultCampaign() {
  const [existing] = await db.select().from(campaigns).orderBy(asc(campaigns.createdAt)).limit(1);
  if (existing) return existing;

  const settings = await getSettings();
  const [created] = await db
    .insert(campaigns)
    .values({
      name: "Default Outreach Campaign",
      description: "Compatibility campaign for existing queue controls.",
      dailyLimit: settings.dailyLimit,
      minDelaySeconds: settings.minDelaySeconds,
      maxDelaySeconds: settings.maxDelaySeconds,
      startTime: settings.startTime,
      endTime: settings.endTime,
      retryCount: settings.retryCount,
      retryIntervalsMinutes: settings.retryIntervalsMinutes,
      attachmentEnabled: settings.attachmentEnabled
    })
    .returning();
  await createLog({ event: "campaign.created", message: "Default campaign created", metadata: { campaignId: created.id } });
  return created;
}

export async function createCampaign(input: z.infer<typeof campaignSchema>) {
  const parsed = campaignSchema.parse(input);
  const [created] = await db.insert(campaigns).values(parsed).returning();
  await createLog({ event: "campaign.created", message: `Campaign created: ${created.name}`, metadata: { campaignId: created.id } });
  return created;
}

export async function updateCampaign(id: number, input: Partial<z.infer<typeof campaignSchema>>) {
  await getCampaign(id);
  const parsed = campaignSchema.partial().parse(input);
  const [updated] = await db.update(campaigns).set({ ...parsed, updatedAt: new Date() }).where(eq(campaigns.id, id)).returning();
  await createLog({ event: "campaign.updated", message: `Campaign updated: ${updated.name}`, metadata: { campaignId: id } });
  return updated;
}

export async function addRecruiterToCampaign(campaignId: number, recruiterId: number) {
  await getCampaign(campaignId);
  const [recruiter] = await db.select().from(recruiters).where(eq(recruiters.id, recruiterId));
  if (!recruiter) throw new NotFoundError("Recruiter not found");

  const [existing] = await db
    .select()
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, campaignId), eq(campaignRecipients.recruiterId, recruiterId)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db.insert(campaignRecipients).values({ campaignId, recruiterId }).returning();
  await createLog({ event: "campaign.recipient_added", message: "Recruiter added to campaign", recruiterId, metadata: { campaignId } });
  return created;
}

export async function enqueueCampaign(campaignId: number) {
  const campaign = await getCampaign(campaignId);
  const members = await db.select().from(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId)).orderBy(asc(campaignRecipients.createdAt));
  let created = 0;
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const [{ value: existing }] = await db.select({ value: count() }).from(emailQueue).where(eq(emailQueue.campaignRecipientId, member.id));
    if (existing > 0) continue;
    
    await db.insert(emailQueue).values({
      campaignId,
      campaignRecipientId: member.id,
      recruiterId: member.recruiterId,
      maxAttempts: campaign.retryCount
    });
    await db.update(campaignRecipients).set({ status: "Queued", updatedAt: new Date() }).where(eq(campaignRecipients.id, member.id));
    created += 1;
  }
  await createLog({ event: "campaign.enqueued", message: `${created} campaign recipient(s) queued`, metadata: { campaignId, created } });
  return { created };
}

export async function enqueuePendingRecruitersIntoDefaultCampaign() {
  const campaign = await getOrCreateDefaultCampaign();
  const pendingRecruiters = await db.select().from(recruiters).where(eq(recruiters.status, "Pending")).orderBy(asc(recruiters.createdAt));
  for (const recruiter of pendingRecruiters) {
    await addRecruiterToCampaign(campaign.id, recruiter.id);
  }
  return enqueueCampaign(campaign.id);
}
