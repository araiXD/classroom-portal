import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireRole } from "../middleware/auth.js";
import { HttpError, unwrap } from "../errors.js";
import { bodyOf, text, uuid } from "../validate.js";

export const classesRouter = Router();

// Join codes are unguessable (48 random bits); this caps online guessing too.
// Keyed by user, and only failed attempts count.
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  message: { error: "Too many failed attempts, try again later" },
});

// Teacher: create a class. Body: { name }
classesRouter.post("/", requireRole("teacher"), async (req, res) => {
  const name = text(bodyOf(req).name, "name", { max: 100 });
  const cls = unwrap(
    await req.db.from("classes").insert({ name, teacher_id: req.user.id }).select().single(),
  );
  res.status(201).json(cls);
});

// Classes the caller can see: a teacher's own, or a student's enrolled ones (via RLS).
classesRouter.get("/", async (req, res) => {
  res.json(unwrap(await req.db.from("classes").select().order("created_at", { ascending: false })));
});

// Student: enroll with a join code. Body: { code }
classesRouter.post("/join", requireRole("student"), joinLimiter, async (req, res) => {
  const code = text(bodyOf(req).code, "code", { max: 64 });
  const classId = unwrap(await req.db.rpc("join_class", { code }));
  res.json(unwrap(await req.db.from("classes").select().eq("id", classId).single()));
});

classesRouter.get("/:id", async (req, res) => {
  const id = uuid(req.params.id, "id");
  const cls = unwrap(await req.db.from("classes").select().eq("id", id).maybeSingle());
  if (!cls) throw new HttpError(404, "Class not found"); // RLS hides classes you can't see
  res.json(cls);
});
