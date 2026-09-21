import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler } from "./errors.js";
import { requireAuth } from "./middleware/auth.js";
import { assignmentsRouter } from "./routes/assignments.js";
import { classesRouter } from "./routes/classes.js";
import { submissionsRouter } from "./routes/submissions.js";
import { uploadsRouter } from "./routes/uploads.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.use("/classes", requireAuth, classesRouter);
  app.use("/assignments", requireAuth, assignmentsRouter);
  app.use("/submissions", requireAuth, submissionsRouter);
  app.use("/uploads", requireAuth, uploadsRouter);

  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);
  return app;
}
