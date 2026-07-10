import { createGmailMimeMessage, gmailProvider } from "../providers/gmail.provider.js";

export type GmailMessageInput = {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  attachment?: {
    path: string;
    originalName: string;
    mimeType: string;
  };
};

export async function createMimeMessage(input: GmailMessageInput) {
  return createGmailMimeMessage({
    to: Array.isArray(input.to) ? input.to : [input.to],
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachment ? [input.attachment] : undefined
  });
}

export async function sendGmailMessage(input: GmailMessageInput) {
  const result = await gmailProvider.send({
    to: Array.isArray(input.to) ? input.to : [input.to],
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachment ? [input.attachment] : undefined
  });
  return { id: result.providerMessageId };
}

export function classifyGmailError(error: unknown): "temporary" | "permanent" {
  return gmailProvider.classifyError(error);
}
