import { eq } from "drizzle-orm";
import { db } from "../database/db.js";
import { gmailImportHistory, recruiters } from "../database/schema.js";
import { gmailProvider } from "../providers/gmail.provider.js";
import { logActivitySummary, recordEmailActivity } from "./emailActivityService.js";

export type SentImportSummary = {
  processed: number;
  imported: number;
  updated: number;
  duplicates: number;
  skipped: number;
  errors: number;
};

function fallbackName(email: string) {
  return email.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || email;
}

export async function importSentEmails(maxMessages = 250): Promise<SentImportSummary> {
  const summary: SentImportSummary = { processed: 0, imported: 0, updated: 0, duplicates: 0, skipped: 0, errors: 0 };
  let pageToken: string | undefined;

  while (summary.processed < maxMessages) {
    const page = await gmailProvider.listSentMessages(Math.min(50, maxMessages - summary.processed), pageToken);
    for (const message of page.messages) {
      summary.processed += 1;
      const primaryRecipient = message.recipients[0];
      if (!primaryRecipient?.email) {
        summary.skipped += 1;
        continue;
      }

      try {
        const [existingImport] = await db.select().from(gmailImportHistory).where(eq(gmailImportHistory.gmailMessageId, message.id)).limit(1);
        if (existingImport) {
          summary.duplicates += 1;
          continue;
        }

        const [existingRecruiter] = await db.select().from(recruiters).where(eq(recruiters.email, primaryRecipient.email)).limit(1);
        let recruiter = existingRecruiter;
        if (!recruiter) {
          const [createdRecruiter] = await db
            .insert(recruiters)
            .values({
              fullName: primaryRecipient.name || fallbackName(primaryRecipient.email),
              company: "Imported from Gmail",
              designation: null,
              email: primaryRecipient.email,
              notes: "Imported from Gmail Sent mail metadata.",
              status: "COMPLETED" as never,
              importedFromGmail: true,
              lastEmailSentAt: message.internalDate ?? new Date(),
              lastGmailThreadId: message.threadId ?? null,
              lastGmailMessageId: message.id
            })
            .returning();
          recruiter = createdRecruiter;
          summary.imported += 1;
        } else {
          await db
            .update(recruiters)
            .set({
              importedFromGmail: true,
              lastEmailSentAt: existingRecruiter.lastEmailSentAt ?? message.internalDate ?? new Date(),
              lastGmailThreadId: existingRecruiter.lastGmailThreadId ?? message.threadId ?? null,
              lastGmailMessageId: existingRecruiter.lastGmailMessageId ?? message.id,
              updatedAt: new Date()
            })
            .where(eq(recruiters.id, existingRecruiter.id));
          summary.updated += 1;
        }

        const [createdImport] = await db
          .insert(gmailImportHistory)
          .values({
            gmailMessageId: message.id,
            gmailThreadId: message.threadId ?? null,
            recruiterId: recruiter.id,
            recipientEmail: primaryRecipient.email,
            recipientName: primaryRecipient.name ?? null,
            subject: message.subject,
            snippet: message.snippet,
            sentAt: message.internalDate ?? new Date(),
            labels: message.labelIds,
            attachments: message.attachments,
            metadata: {
              recipients: message.recipients,
              from: message.headers.from ?? "",
              threadLink: message.threadId ? gmailProvider.getThreadLink(message.threadId) : null
            }
          })
          .onConflictDoNothing()
          .returning();

        if (!createdImport) {
          summary.duplicates += 1;
          continue;
        }

        await recordEmailActivity({
          eventType: "IMPORTED",
          recruiterId: recruiter.id,
          gmailMessageId: message.id,
          gmailThreadId: message.threadId,
          occurredAt: message.internalDate ?? new Date(),
          metadata: {
            subject: message.subject,
            recipientEmail: primaryRecipient.email,
            source: "gmail.sent"
          }
        });
      } catch {
        summary.errors += 1;
      }
    }

    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }

  await logActivitySummary("email.sent_imported", `Imported ${summary.imported} sent email metadata record(s)`, summary);
  return summary;
}
