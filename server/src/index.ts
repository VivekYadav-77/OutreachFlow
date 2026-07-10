import { app } from "./app.js";
import { config } from "./config.js";
import { ensureDefaultSettings } from "./database/seed.js";
import { startScheduler } from "./scheduler/scheduler.js";
import { consoleLogger } from "./utils/logger.js";

async function main() {
  await ensureDefaultSettings();
  startScheduler();
  app.listen(config.PORT, () => {
    consoleLogger.info(`API listening on http://localhost:${config.PORT}`);
  });
}

main().catch((error) => {
  consoleLogger.error(error, "Failed to start server");
  process.exit(1);
});
