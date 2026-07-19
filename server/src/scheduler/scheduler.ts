import cron from "node-cron";
import { getSettings } from "../services/settingsService.js";
import { emailWorker } from "../workers/emailWorker.js";
import { checkBounces } from "../services/bounceMonitorService.js";
import { createLog } from "../services/logService.js";

export function startScheduler() {
  let bounceCheckRunning = false;
  cron.schedule("* * * * *", async () => {
    const settings = await getSettings();
    if (settings.workerStatus === "running" && !emailWorker.isRunning()) {
      await emailWorker.start();
    }
  });

  cron.schedule("*/30 * * * *", async () => {
    if (bounceCheckRunning) return;
    bounceCheckRunning = true;
    try {
      await checkBounces(10);
    } catch (error) {
      await createLog({
        level: "warn",
        event: "email.bounce_check_failed",
        message: error instanceof Error ? error.message : "Scheduled bounce check failed"
      });
    } finally {
      bounceCheckRunning = false;
    }
  });
}
