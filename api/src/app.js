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

  // Render (like Heroku) puts one reverse proxy in front of the app and sets
  // X-Forwarded-For. Trusting exactly that one hop makes req.ip and req.secure
  // correct, and stops express-rate-limit's proxy-mismatch validation from
  // erroring on every request. `1` trusts one hop, not "any proxy" (which would
  // let a client spoof its own IP via the header) — harmless locally, where
  // there's no proxy and the header is never present.
  app.set("trust proxy", 1);

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
