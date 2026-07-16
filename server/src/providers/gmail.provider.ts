import fs from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import mime from "mime-types";
import { eq } from "drizzle-orm";
import { config, hasGoogleConfig } from "../config.js";
import { db } from "../database/db.js";
import { oauthTokens } from "../database/schema.js";
import { AuthRequiredError, OAuthError } from "../utils/errors.js";
import { detectGoogleAuthFailure } from "../auth/googleAuthFailure.js";
import { decryptToken, encryptToken } from "../auth/tokenCrypto.js";
import {
  getGoogleConnectionStatus,
  markGoogleConnected,
  markGoogleTokenRefreshed,
  markGoogleTokenRefreshAttempt,
  resumeAfterGoogleReconnect
} from "../services/oauthConnectionService.js";
import type { BuiltEmail, EmailProvider, SendEmailResult } from "./emailProvider.js";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

function encodeBase64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function header(value: string) {
  return value.replace(/\r?\n/g, " ");
}

function addressHeader(values: string[] | undefined) {
  return (values ?? []).map(header).join(", ");
}

function getOAuthClient() {
  if (!hasGoogleConfig()) throw new OAuthError("Google OAuth environment variables are not configured");
  return new google.auth.OAuth2(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI);
}

export function getGoogleAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GMAIL_SEND_SCOPE, "https://www.googleapis.com/auth/userinfo.email"]
  });
}

export async function handleGoogleCallback(code: string) {
  const client = getOAuthClient();
  let tokens;
  try {
    const response = await client.getToken(code);
    tokens = response.tokens;
  } catch (error: any) {
    throw new OAuthError(`Google token exchange failed: ${error.message || "Unknown error"}`, error);
  }
  if (!tokens.refresh_token) throw new OAuthError("Google did not return a refresh token. Try reconnecting with consent prompt.");

  const [existing] = await db.select().from(oauthTokens).where(eq(oauthTokens.provider, "google")).limit(1);
  const isReconnect = Boolean(existing);
  const values = {
    provider: "google",
    refreshToken: encryptToken(tokens.refresh_token),
    accessToken: tokens.access_token ?? null,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope ?? GMAIL_SEND_SCOPE,
    tokenType: tokens.token_type ?? "Bearer",
    status: "CONNECTED" as const,
    lastConnectedAt: new Date(),
    lastReconnectAt: isReconnect ? new Date() : null,
    lastAuthFailureAt: null,
    lastAuthFailureReason: null,
    updatedAt: new Date()
  };

  let tokenId: number;
  if (existing) {
    const [updated] = await db.update(oauthTokens).set(values).where(eq(oauthTokens.id, existing.id)).returning();
    tokenId = updated.id;
  } else {
    const [created] = await db.insert(oauthTokens).values(values).returning();
    tokenId = created.id;
  }
  await markGoogleConnected(tokenId, isReconnect);
  return resumeAfterGoogleReconnect();
}

export async function getAuthStatus() {
  const [token] = await db.select().from(oauthTokens).where(eq(oauthTokens.provider, "google")).limit(1);
  let emailAddress = null;

  if (token?.status === "CONNECTED") {
    try {
      const auth = await getAuthorizedOAuthClient();
      const oauth2 = google.oauth2({ version: "v2", auth });
      const profile = await oauth2.userinfo.get();
      emailAddress = profile.data.email;
    } catch (e) {
      // Silently fail if they don't have the userinfo.email scope yet
      // The frontend will just fallback to showing "Connected"
    }
  }

  return {
    configured: hasGoogleConfig(),
    connected: token?.status === "CONNECTED",
    status: token?.status ?? "DISCONNECTED",
    emailAddress,
    scope: token?.scope,
    lastConnectedAt: token?.lastConnectedAt,
    lastRefreshAt: token?.lastRefreshAt,
    lastAuthFailureAt: token?.lastAuthFailureAt,
    lastAuthFailureReason: token?.lastAuthFailureReason,
    lastReconnectAt: token?.lastReconnectAt,
    updatedAt: token?.updatedAt
  };
}

async function getAuthorizedOAuthClient() {
  const { token, status } = await getGoogleConnectionStatus();
  if (!token) throw new OAuthError("Google account is not connected");
  if (status !== "CONNECTED") throw new AuthRequiredError();
  const client = getOAuthClient();
  client.setCredentials({
    refresh_token: decryptToken(token.refreshToken),
    access_token: token.accessToken ?? undefined,
    expiry_date: token.expiryDate?.getTime()
  });
  client.on("tokens", (tokens) => {
    void markGoogleTokenRefreshed(tokens.access_token ?? null, tokens.expiry_date ? new Date(tokens.expiry_date) : null).catch(() => undefined);
  });
  await markGoogleTokenRefreshAttempt();
  return client;
}

export async function createGmailMimeMessage(input: BuiltEmail) {
  const boundary = `boundary_${Date.now()}`;
  const altBoundary = `alt_${Date.now()}`;
  const lines: string[] = [
    `To: ${addressHeader(input.to)}`,
    ...(input.cc?.length ? [`Cc: ${addressHeader(input.cc)}`] : []),
    ...(input.bcc?.length ? [`Bcc: ${addressHeader(input.bcc)}`] : []),
    `Subject: ${header(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.text,
    "",
    `--${altBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.html,
    "",
    `--${altBoundary}--`
  ];

  for (const attachment of input.attachments ?? []) {
    const content = await fs.readFile(attachment.path);
    const mimeType = attachment.mimeType || mime.lookup(attachment.path) || "application/octet-stream";
    lines.push(
      "",
      `--${boundary}`,
      `Content-Type: ${mimeType}; name="${path.basename(attachment.originalName)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${path.basename(attachment.originalName)}"`,
      "",
      content.toString("base64")
    );
  }

  lines.push("", `--${boundary}--`);
  return lines.join("\r\n");
}

export class GmailProvider implements EmailProvider {
  async send(email: BuiltEmail): Promise<SendEmailResult> {
    try {
      const auth = await getAuthorizedOAuthClient();
      const gmail = google.gmail({ version: "v1", auth });
      const raw = encodeBase64Url(await createGmailMimeMessage(email));
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw }
      });
      return { providerMessageId: response.data.id ?? undefined };
    } catch (error) {
      const authFailure = detectGoogleAuthFailure(error);
      if (authFailure.isAuthFailure) {
        throw new AuthRequiredError("Google authorization expired. Reconnect your account.", {
          reason: authFailure.reason,
          code: authFailure.code,
          status: authFailure.status
        });
      }
      throw error;
    }
  }

  classifyError(error: unknown): "temporary" | "permanent" {
    if (error instanceof AuthRequiredError || detectGoogleAuthFailure(error).isAuthFailure) return "permanent";
    const status = typeof error === "object" && error && "code" in error ? Number((error as { code?: unknown }).code) : undefined;
    if (!status) return "temporary";
    if ([429, 500, 502, 503, 504].includes(status)) return "temporary";
    return "permanent";
  }
}

export const gmailProvider = new GmailProvider();
