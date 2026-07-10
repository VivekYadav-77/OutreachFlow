import type { EmailProvider, SendEmailResult } from "../providers/emailProvider.js";
import type { BuiltEmail } from "../providers/emailProvider.js";
import { gmailProvider } from "../providers/gmail.provider.js";

export class EmailService {
  constructor(private readonly provider: EmailProvider = gmailProvider) {}

  async sendComposedEmail(email: BuiltEmail): Promise<SendEmailResult> {
    return this.provider.send(email);
  }

  classifyError(error: unknown) {
    return this.provider.classifyError(error);
  }
}

export const emailService = new EmailService();
