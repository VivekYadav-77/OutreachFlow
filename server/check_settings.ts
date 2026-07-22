import { db } from "./src/database/db.js";
import { settings } from "./src/database/schema.js";

async function main() {
  try {
    const s = await db.select().from(settings);
    console.log("Settings:", JSON.stringify(s, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

main();
