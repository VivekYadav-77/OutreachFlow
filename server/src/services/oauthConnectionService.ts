import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "../database/db.js";
import { campaigns, emailDrafts, emailQueue, oauthTokens } from "../database/schema.js";
import { createLog } from "./logService.js";

export type OAuthConnectionStatus = "CONNECTED" | "AUTH_REQUIRED" | "CONNECTING" | "DISCONNECTED" | "ERROR";

export const AUTH_REQUIRED_MESSAGE = "Google authorization expired. Reconnect your account.";

export async function getGoogleOAuthToken() {
  const [token] = await db.select().from(oauthTokens).where(eq(oauthTokens.provider, "google")).limit(1);
  return token;
}

export async function getGoogleConnectionStatus() {
  const token = await getGoogleOAuthToken();
  if (!token) {
    return {
      status: "DISCONNECTED" as OAuthConnectionStatus,
      connected: false,
      token: null
    };
  }
  return {
    status: token.status as OAuthConnectionStatus,
    connected: token.status === "CONNECTED",
    token
  };
}

export async function markGoogleConnecting() {
  const token = await getGoogleOAuthToken();
  if (!token) return;
  await db.update(oauthTokens).set({ status: "CONNECTING", updatedAt: new Date() }).where(eq(oauthTokens.id, token.id));
}

export async function markGoogleTokenRefreshAttempt() {
  const token = await getGoogleOAuthToken();
  if (!token) return;
  await db
    .update(oauthTokens)
    .set({ lastTokenRefreshAttemptAt: new Date(), updatedAt: new Date() })
    .where(eq(oauthTokens.id, token.id));
}

export async function markGoogleTokenRefreshed(accessToken?: string | null, expiryDate?: Date | null) {
  const token = await getGoogleOAuthToken();
  if (!token) return;
  await db
    .update(oauthTokens)
    .set({
      accessToken: accessToken ?? token.accessToken,
      expiryDate: expiryDate ?? token.expiryDate,
      lastRefreshAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(oauthTokens.id, token.id));
}

export async function markGoogleConnected(tokenId: number, isReconnect: boolean) {
  const now = new Date();
  await db
    .update(oauthTokens)
    .set({
      status: "CONNECTED",
      lastConnectedAt: now,
      lastReconnectAt: isReconnect ? now : null,
      lastAuthFailureAt: null,
      lastAuthFailureReason: null,
      updatedAt: now
    })
    .where(eq(oauthTokens.id, tokenId));
  await createLog({ event: isReconnect ? "auth.reconnected" : "auth.connected", message: isReconnect ? "Google OAuth reconnected" : "Google OAuth connected" });
}

export async function pauseSendingForAuthFailure(reason: string, queueId?: number) {
  const now = new Date();
  const token = await getGoogleOAuthToken();
  if (token) {
    await db
      .update(oauthTokens)
      .set({
        status: "AUTH_REQUIRED",
        lastAuthFailureAt: now,
        lastAuthFailureReason: reason,
        updatedAt: now
      })
      .where(eq(oauthTokens.id, token.id));
  }

  const pausedCampaigns = await db
    .update(campaigns)
    .set({
      status: "PAUSED_AUTH",
      pauseReason: "Google authentication expired",
      pausedAt: now,
      updatedAt: now
    })
    .where(inArray(campaigns.status, ["Running", "Scheduled"]))
    .returning({ id: campaigns.id });

  const pausedJobs = await db
    .update(emailQueue)
    .set({
      state: "Paused",
      lastError: AUTH_REQUIRED_MESSAGE,
      lockedBy: null,
      claimedAt: null,
      updatedAt: now
    })
    .where(inArray(emailQueue.state, ["Pending", "Sending", "Retrying"]))
    .returning({ id: emailQueue.id, draftId: emailQueue.draftId });

  const draftIds = pausedJobs.map((job) => job.draftId).filter((draftId): draftId is number => typeof draftId === "number");
  if (draftIds.length > 0) {
    await db
      .update(emailDrafts)
      .set({ status: "Queued", lastError: AUTH_REQUIRED_MESSAGE, updatedAt: now })
      .where(and(inArray(emailDrafts.id, draftIds), eq(emailDrafts.status, "Sending")));
  }

  await createLog({
    level: "error",
    event: "auth.failed",
    message: AUTH_REQUIRED_MESSAGE,
    queueId,
    metadata: { reason, pausedCampaigns: pausedCampaigns.length, pausedJobs: pausedJobs.length }
  });
  await createLog({ event: "worker.stopped_auth", message: "Worker stopped because Google authorization is required", queueId });

  for (const campaign of pausedCampaigns) {
    await createLog({
      event: "campaign.paused_auth",
      message: "Campaign paused because Google authorization is required",
      metadata: { campaignId: campaign.id }
    });
  }

  return { pausedCampaigns: pausedCampaigns.length, pausedJobs: pausedJobs.length };
}

export async function resumeAfterGoogleReconnect() {
  const now = new Date();
  const resumedCampaigns = await db
    .update(campaigns)
    .set({
      status: "Running",
      pauseReason: null,
      resumedAt: now,
      updatedAt: now
    })
    .where(eq(campaigns.status, "PAUSED_AUTH"))
    .returning({ id: campaigns.id });

  const resumedJobs = await db
    .update(emailQueue)
    .set({
      state: "Pending",
      lastError: null,
      nextAttemptAt: null,
      lockedBy: null,
      claimedAt: null,
      updatedAt: now
    })
    .where(and(eq(emailQueue.state, "Paused"), eq(emailQueue.lastError, AUTH_REQUIRED_MESSAGE), isNotNull(emailQueue.draftId)))
    .returning({ id: emailQueue.id, draftId: emailQueue.draftId });

  const draftIds = resumedJobs.map((job) => job.draftId).filter((draftId): draftId is number => typeof draftId === "number");
  if (draftIds.length > 0) {
    await db
      .update(emailDrafts)
      .set({ status: "Queued", lastError: null, updatedAt: now })
      .where(inArray(emailDrafts.id, draftIds));
  }

  for (const campaign of resumedCampaigns) {
    await createLog({ event: "campaign.resumed", message: "Campaign resumed after Google OAuth reconnect", metadata: { campaignId: campaign.id } });
  }
  if (resumedJobs.length > 0) {
    await createLog({ event: "queue.resumed_auth", message: `${resumedJobs.length} auth-paused queue job(s) resumed`, metadata: { count: resumedJobs.length } });
  }
  return { resumedCampaigns: resumedCampaigns.length, resumedJobs: resumedJobs.length };
}
