import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "../config.js";

const PREFIX = "enc:v1:";

function getKey() {
  const material = config.TOKEN_ENCRYPTION_KEY ?? config.GOOGLE_CLIENT_SECRET ?? config.DATABASE_URL;
  return createHash("sha256").update(material).digest();
}

export function encryptToken(token: string) {
  if (token.startsWith(PREFIX)) return token;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptToken(token: string) {
  if (!token.startsWith(PREFIX)) return token;
  const encoded = token.slice(PREFIX.length);
  const [ivValue, tagValue, encryptedValue] = encoded.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Stored token is not a valid encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}
