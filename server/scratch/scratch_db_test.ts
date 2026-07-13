import { db } from "./src/database/db.js";
import { oauthTokens, sendLogs } from "./src/database/schema.js";
import { eq } from "drizzle-orm";

async function test() {
  try {
    console.log("Testing DB connection and schema...");
    const [existing] = await db.select().from(oauthTokens).where(eq(oauthTokens.provider, "google")).limit(1);
    console.log("Existing token:", existing);

    const values = {
      provider: "google",
      refreshToken: "fake_refresh_token",
      accessToken: "fake_access_token",
      expiryDate: new Date(),
      scope: "https://www.googleapis.com/auth/gmail.send",
      tokenType: "Bearer",
      updatedAt: new Date()
    };

    console.log("Attempting insert/update...");
    if (existing) {
      // @ts-ignore
      await db.update(oauthTokens).set(values).where(eq(oauthTokens.id, existing.id));
    } else {
      // @ts-ignore
      await db.insert(oauthTokens).values(values);
    }
    console.log("Insert/update successful.");

    console.log("Testing createLog...");
    await db.insert(sendLogs).values({
      level: "info",
      event: "auth.connected",
      message: "Google OAuth connected",
      metadata: {}
    });
    console.log("Log inserted successfully.");

  } catch (error) {
    console.error("DB TEST ERROR:", error);
  } finally {
    process.exit(0);
  }
}

test();
