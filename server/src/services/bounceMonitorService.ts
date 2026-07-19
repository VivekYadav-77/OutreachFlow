import { eq } from "drizzle-orm";
import { db } from "../database/db.js";
import { emailBounce, recruiters } from "../database/schema.js";
import { gmailProvider, type GmailMessageMetadata } from "../providers/gmail.provider.js";
import { logActivitySummary, recordEmailActivity } from "./emailActivityService.js";

export type BounceCheckSummary = {
  processed: number;
  detected: number;
  permanent: number;
  temporary: number;
  duplicates: number;
  skipped: number;
};

export function parseBounce(message: GmailMessageMetadata) {
  const text = [message.headers.subject, message.snippet, message.payloadText].filter(Boolean).join("\n");
  const emailMatch =
    text.match(/(?:Final-Recipient|Original-Recipient):\s*rfc822;\s*([^\s<>;]+)/i) ??
    text.match(/(?:failed|undeliverable|could not be delivered)[\s\S]{0,180}?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i) ??
    text.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  const smtpMatch = text.match(/\b([245]\.\d\.\d)\b/) ?? text.match(/\b([245]\d{2})\b/);
  const actionMatch = text.match(/Action:\s*(failed|delayed|expanded|relayed|delivered)/i);
  const reasonMatch = text.match(/(?:Diagnostic-Code|Status|Reason):\s*([^\n\r]+)/i);
  const recipientEmail = emailMatch?.[1]?.toLowerCase();
  if (!recipientEmail) return null;

  const smtpCode = smtpMatch?.[1];
  const isTemporary = actionMatch?.[1]?.toLowerCase() === "delayed" || smtpCode?.startsWith("4");
  const isPermanent = smtpCode?.startsWith("5") || /user unknown|address not found|no such user|recipient address rejected/i.test(text);
  return {
    recipientEmail,
    smtpCode,
    reason: reasonMatch?.[1]?.trim() || message.snippet || "Delivery failure detected",
    bounceType: isTemporary && !isPermanent ? "TEMPORARY_FAILURE" : "INVALID_ADDRESS"
  };
}

export async function checkBounces(maxMessages = 25): Promise<BounceCheckSummary> {
  const summary: BounceCheckSummary = { processed: 0, detected: 0, permanent: 0, temporary: 0, duplicates: 0, skipped: 0 };
  const results = await gmailProvider.searchBounceMessages(maxMessages);

  for (const hit of results.messages) {
    summary.processed += 1;
    const message = await gmailProvider.getMessage(hit.id);
    const parsed = parseBounce(message);
    if (!parsed) {
      summary.skipped += 1;
      continue;
    }

    const [recruiter] = await db.select().from(recruiters).where(eq(recruiters.email, parsed.recipientEmail)).limit(1);
    const bouncedAt = message.internalDate ?? new Date();
    const [created] = await db
      .insert(emailBounce)
      .values({
        recruiterId: recruiter?.id ?? null,
        recipientEmail: parsed.recipientEmail,
        bounceType: parsed.bounceType,
        reason: parsed.reason,
        smtpCode: parsed.smtpCode ?? null,
        gmailMessageId: message.id,
        gmailThreadId: message.threadId ?? null,
        bouncedAt,
        metadata: { subject: message.headers.subject ?? "", snippet: message.snippet }
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      summary.duplicates += 1;
      continue;
    }

    summary.detected += 1;
    if (parsed.bounceType === "INVALID_ADDRESS") summary.permanent += 1;
    else summary.temporary += 1;

    if (recruiter) {
      await recordEmailActivity({
        eventType: "BOUNCE",
        recruiterId: recruiter.id,
        gmailMessageId: message.id,
        gmailThreadId: message.threadId,
        recruiterStatus: parsed.bounceType,
        occurredAt: bouncedAt,
        metadata: {
          recipientEmail: parsed.recipientEmail,
          bounceType: parsed.bounceType,
          reason: parsed.reason,
          smtpCode: parsed.smtpCode
        }
      });
    }
  }

  await logActivitySummary("email.bounces_checked", `Detected ${summary.detected} bounce(s)`, summary);
  return summary;
}
