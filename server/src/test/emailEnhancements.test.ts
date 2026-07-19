import { describe, expect, it } from "vitest";
import { parseAddressList } from "../providers/gmail.provider.js";
import { parseBounce } from "../services/bounceMonitorService.js";
import {
  buildActivityDateRange,
  formatActivityExportTimestamp,
  mapLifecycleToLegacyStatus,
  resolveActivityExportBounceType
} from "../services/emailActivityService.js";

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

  it("builds full-day date filters when time is omitted", () => {
    const range = buildActivityDateRange({ fromDate: "2026-07-18", toDate: "2026-07-19" });

    expect(range.from).toEqual(new Date(2026, 6, 18, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 6, 19, 23, 59, 59, 999));
  });

  it("builds exact date and time filters when time is provided", () => {
    const range = buildActivityDateRange({ fromDate: "2026-07-18", fromTime: "09:15", toDate: "2026-07-18", toTime: "17:45" });

    expect(range.from).toEqual(new Date(2026, 6, 18, 9, 15, 0, 0));
    expect(range.to).toEqual(new Date(2026, 6, 18, 17, 45, 59, 999));
  });

  it("rejects inverted date and time filters", () => {
    expect(() => buildActivityDateRange({ fromDate: "2026-07-19", fromTime: "10:00", toDate: "2026-07-18", toTime: "10:00" })).toThrow();
  });

  it("formats export timestamps into separate date and time fields", () => {
    expect(formatActivityExportTimestamp(new Date(2026, 6, 19, 9, 5, 30))).toEqual({
      date: "2026-07-19",
      time: "09:05"
    });
  });

  it("resolves export bounce type from metadata, bounce records, or bounce status", () => {
    expect(
      resolveActivityExportBounceType({
        eventType: "BOUNCE",
        metadata: { bounceType: "INVALID_ADDRESS" },
        bounceType: null,
        recruiterStatus: "Failed"
      })
    ).toBe("INVALID_ADDRESS");
    expect(
      resolveActivityExportBounceType({
        eventType: "BOUNCE",
        metadata: {},
        bounceType: "TEMPORARY_FAILURE",
        recruiterStatus: "Failed"
      })
    ).toBe("TEMPORARY_FAILURE");
    expect(
      resolveActivityExportBounceType({
        eventType: "BOUNCE",
        metadata: {},
        bounceType: null,
        recruiterStatus: "INVALID_ADDRESS"
      })
    ).toBe("INVALID_ADDRESS");
  });
});
