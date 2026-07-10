import cors from "cors";
import express from "express";
import fs from "node:fs";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { authRoutes } from "./routes/authRoutes.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { draftRoutes } from "./routes/draftRoutes.js";
import { logRoutes } from "./routes/logRoutes.js";
import { queueRoutes } from "./routes/queueRoutes.js";
import { recruiterRoutes } from "./routes/recruiterRoutes.js";
import { settingsRoutes } from "./routes/settingsRoutes.js";
import { statisticsRoutes } from "./routes/statisticsRoutes.js";
import { uploadRoutes } from "./routes/uploadRoutes.js";

fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(config.logsDir, { recursive: true });

export const app = express();

app.use(cors({ origin: config.CLIENT_URL }));
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/recruiters", recruiterRoutes);
app.use("/api/drafts", draftRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/statistics", statisticsRoutes);

app.use(errorHandler);
