import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { settings } from "./schema.js";

export async function ensureDefaultSettings() {
  const existing = await db.select().from(settings).limit(1);
  if (existing.length === 0) {
    await db.insert(settings).values({});
  } else if (existing[0].id !== 1) {
    await db.update(settings).set({ updatedAt: new Date() }).where(eq(settings.id, existing[0].id));
  }
}
