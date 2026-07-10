import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import { config } from "../config.js";

fs.mkdirSync(config.logsDir, { recursive: true });

const fileTransport = pino.destination({
  dest: path.join(config.logsDir, "app.log"),
  sync: false
});

export const logger = pino(
  {
    level: config.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime
  },
  fileTransport
);

export const consoleLogger = pino({
  level: config.LOG_LEVEL,
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true }
        }
});
