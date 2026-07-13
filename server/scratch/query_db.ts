import { db } from "../src/database/db.js";
import { recruiters, settings, emailQueue } from "../src/database/schema.js";

async function main() {
  try {
    const allSettings = await db.select().from(settings);
    console.log("--- SETTINGS ---");
    console.log(JSON.stringify(allSettings, null, 2));

    const allRecruiters = await db.select().from(recruiters);
    console.log("\n--- RECRUITERS ---");
    console.log(JSON.stringify(allRecruiters, null, 2));

    const allQueue = await db.select().from(emailQueue);
    console.log("\n--- EMAIL QUEUE ---");
    console.log(JSON.stringify(allQueue, null, 2));

  } catch (error) {
    console.error("Error querying db:", error);
  } finally {
    process.exit(0);
  }
}

main();
