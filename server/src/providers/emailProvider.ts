export type EmailAttachment = {
  path: string;
  originalName: string;
  mimeType: string;
};

export type BuiltEmail = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult = {
  providerMessageId?: string;
  providerThreadId?: string;
};

export type EmailProvider = {
  send(email: BuiltEmail): Promise<SendEmailResult>;
  classifyError(error: unknown): "temporary" | "permanent";
};
