import { describe, expect, it } from "vitest";
import { recruiterSchema } from "./recruiterService.js";
import { settingsSchema } from "./settingsService.js";

describe("validation", () => {
  it("normalizes recruiter emails", () => {
    const parsed = recruiterSchema.parse({ fullName: "Alex", company: "Acme", email: "ALEX@EXAMPLE.COM" });
    expect(parsed.email).toBe("alex@example.com");
  });

  it("rejects inverted delay ranges", () => {
    const parsed = settingsSchema.safeParse({ minDelaySeconds: 150, maxDelaySeconds: 45 });
    expect(parsed.success).toBe(false);
  });
});
