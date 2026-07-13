import { describe, expect, it } from "vitest";
import { draftSchema } from "../services/draftService.js";

describe("draftSchema", () => {
  it("normalizes recipient addresses", () => {
    const parsed = draftSchema.parse({
      to: ["ALEX@EXAMPLE.COM"],
      cc: ["Team@Example.com"],
      bcc: [],
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi"
    });

    expect(parsed.to).toEqual(["alex@example.com"]);
    expect(parsed.cc).toEqual(["team@example.com"]);
  });

  it("rejects invalid recipient addresses", () => {
    expect(() => draftSchema.parse({ to: ["not-an-email"] })).toThrow();
  });
});
