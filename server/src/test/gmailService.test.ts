import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyGmailError, createMimeMessage } from "../gmail/gmailService.js";

describe("gmailService", () => {
  it("creates a MIME message with HTML, text, and optional attachment", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "gmail-mime-"));
    const file = path.join(dir, "resume.pdf");
    await writeFile(file, "%PDF test");

    const message = await createMimeMessage({
      to: ["recruiter@example.com", "lead@example.com"],
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
      attachment: { path: file, originalName: "resume.pdf", mimeType: "application/pdf" }
    });

    expect(message).toContain("To: recruiter@example.com, lead@example.com");
    expect(message).toContain("Cc: cc@example.com");
    expect(message).toContain("Bcc: bcc@example.com");
    expect(message).toContain("Content-Type: text/html");
    expect(message).toContain("Content-Disposition: attachment");
    await rm(dir, { recursive: true, force: true });
  });

  it("classifies rate limits and server errors as temporary", () => {
    expect(classifyGmailError({ code: 429 })).toBe("temporary");
    expect(classifyGmailError({ code: 503 })).toBe("temporary");
    expect(classifyGmailError({ code: 400 })).toBe("permanent");
  });
});
