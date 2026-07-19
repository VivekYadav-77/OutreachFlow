import { describe, expect, it } from "vitest";
import { recruiterSchema } from "../services/recruiterService.js";
import { settingsSchema } from "../services/settingsService.js";

describe("validation", () => {
  it("normalizes recruiter emails", () => {
    const parsed = recruiterSchema.parse({ fullName: "Alex", company: "Acme", email: "ALEX@EXAMPLE.COM" });
    expect(parsed.email).toBe("alex@example.com");
  });

  it("rejects inverted delay ranges", () => {
    const parsed = settingsSchema.safeParse({ minDelaySeconds: 150, maxDelaySeconds: 45 });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid working-hour time values", () => {
    const parsed = settingsSchema.safeParse({ startTime: "25:00", endTime: "18:00" });
    expect(parsed.success).toBe(false);
  });

  it("rejects inverted working-hour ranges", () => {
    const parsed = settingsSchema.safeParse({ startTime: "18:00", endTime: "09:00" });
    expect(parsed.success).toBe(false);
  });

  it("accepts safe settings values", () => {
    const parsed = settingsSchema.safeParse({
      dailyLimit: "80",
      minDelaySeconds: "45",
      maxDelaySeconds: "150",
      startTime: "09:00",
      endTime: "18:00",
      retryCount: "3",
      retryIntervalsMinutes: [5, 15, 30]
    });
    expect(parsed.success).toBe(true);
  });
});
