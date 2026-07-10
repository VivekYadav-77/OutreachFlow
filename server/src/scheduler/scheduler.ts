import cron from "node-cron";
import { getSettings } from "../services/settingsService.js";
import { emailWorker } from "../workers/emailWorker.js";

export function startScheduler() {
  cron.schedule("* * * * *", async () => {
    const settings = await getSettings();
    if (settings.workerStatus === "running" && !emailWorker.isRunning()) {
      await emailWorker.start();
    }
  });
}
