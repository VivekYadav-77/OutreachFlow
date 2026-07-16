import { describe, expect, it } from "vitest";
import { detectGoogleAuthFailure } from "../auth/googleAuthFailure.js";
import { decryptToken, encryptToken } from "../auth/tokenCrypto.js";
import { AuthRequiredError } from "../utils/errors.js";
import { classifyGmailError } from "../gmail/gmailService.js";

describe("google auth failure handling", () => {
  it("detects invalid_grant refresh token failures", () => {
    const result = detectGoogleAuthFailure({
      response: {
        data: {
          error: "invalid_grant",
          error_description: "Token has been expired or revoked."
        }
      }
    });

    expect(result.isAuthFailure).toBe(true);
    expect(result.code).toBe("invalid_grant");
  });

  it("detects unauthorized Gmail API responses", () => {
    const result = detectGoogleAuthFailure({ code: 401, message: "Invalid Credentials" });

    expect(result.isAuthFailure).toBe(true);
    expect(result.status).toBe(401);
  });

  it("does not classify rate limits as auth failures", () => {
    const result = detectGoogleAuthFailure({ code: 429, message: "Rate limit exceeded" });

    expect(result.isAuthFailure).toBe(false);
  });

  it("classifies structured auth-required errors as permanent", () => {
    expect(classifyGmailError(new AuthRequiredError())).toBe("permanent");
  });

  it("encrypts refresh tokens and supports legacy plaintext reads", () => {
    const encrypted = encryptToken("refresh-token-value");

    expect(encrypted).not.toBe("refresh-token-value");
    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    expect(decryptToken(encrypted)).toBe("refresh-token-value");
    expect(decryptToken("legacy-refresh-token")).toBe("legacy-refresh-token");
  });
});
