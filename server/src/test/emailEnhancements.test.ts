import { describe, expect, it } from "vitest";
import { parseAddressList } from "../providers/gmail.provider.js";
import { parseBounce } from "../services/bounceMonitorService.js";
import { mapLifecycleToLegacyStatus } from "../services/emailActivityService.js";

describe("email enhancement helpers", () => {
  it("maps new recruiter lifecycle statuses to legacy-compatible labels", () => {
    expect(mapLifecycleToLegacyStatus("NEW")).toBe("Pending");
    expect(mapLifecycleToLegacyStatus("ACCEPTED_BY_GMAIL")).toBe("Sent");
    expect(mapLifecycleToLegacyStatus("REPLIED")).toBe("Replied");
    expect(mapLifecycleToLegacyStatus("INVALID_ADDRESS")).toBe("Failed");
    expect(mapLifecycleToLegacyStatus("Skipped")).toBe("Skipped");
  });

  it("parses common Gmail address headers", () => {
    expect(parseAddressList('"Jane Doe" <Jane.Doe@Example.com>, lead@example.com')).toEqual([
      { name: "Jane Doe", email: "jane.doe@example.com" },
      { email: "lead@example.com" }
    ]);
  });

  it("classifies permanent and temporary bounce messages", () => {
    const permanent = parseBounce({
      id: "bounce-1",
      threadId: "thread-1",
      snippet: "Address not found",
      labelIds: [],
      headers: { subject: "Delivery Status Notification" },
      payloadText: "Final-Recipient: rfc822; bad@example.com\nDiagnostic-Code: smtp; 550 5.1.1 user unknown",
      attachments: []
    });
    const temporary = parseBounce({
      id: "bounce-2",
      threadId: "thread-2",
      snippet: "Delivery delayed",
      labelIds: [],
      headers: { subject: "Delivery incomplete" },
      payloadText: "Final-Recipient: rfc822; slow@example.com\nAction: delayed\nStatus: 4.2.0",
      attachments: []
    });

    expect(permanent).toMatchObject({ recipientEmail: "bad@example.com", bounceType: "INVALID_ADDRESS", smtpCode: "5.1.1" });
    expect(temporary).toMatchObject({ recipientEmail: "slow@example.com", bounceType: "TEMPORARY_FAILURE", smtpCode: "4.2.0" });
  });
});
